"use server"

import { revalidatePath } from "next/cache"
import { registerUser, loginUser, logoutUser, getCurrentUser } from "@/lib/auth"
import { sendMessage, createChat, getUserChats, getAllUsers, updateUserPresence } from "@/lib/chat"

// Login action
export async function login(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return { success: false, message: "Email and password are required" }
    }

    const { user, session } = await loginUser(email, password)

    if (user && session) {
      // Set user as online
      try {
        await updateUserPresence(user.id, true)
      } catch (error) {
        console.error("Error updating user presence:", error)
      }

      revalidatePath("/")
      return { success: true, redirect: "/chat" }
    } else {
      return {
        success: false,
        message: "Invalid email or password",
      }
    }
  } catch (error) {
    console.error("Login error:", error)

    if (error instanceof Error) {
      const msg = error.message || ""

      if (msg.toLowerCase().includes("email not confirmed")) {
        return {
          success: false,
          message:
            "Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư (kể cả mục Spam) và bấm vào link xác nhận, sau đó thử đăng nhập lại.",
        }
      }

      if (msg.toLowerCase().includes("invalid login credentials")) {
        return {
          success: false,
          message: "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.",
        }
      }

      return {
        success: false,
        message: msg || "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.",
      }
    }

    return {
      success: false,
      message: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.",
    }
  }
}

// Register action
export async function register(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    if (!email || !username || !password) {
      return { success: false, message: "Email, username and password are required" }
    }

    const { user, session } = await registerUser(email, password, username)

    // Nếu Supabase yêu cầu xác thực email, có thể có user nhưng không có session
    if (user) {
      if (session) {
        // Chỉ cập nhật trạng thái online nếu có session
        try {
          await updateUserPresence(user.id, true)
        } catch (error) {
          console.error("Error updating user presence:", error)
        }

        revalidatePath("/")
        return { success: true, redirect: "/chat" }
      }

      // Đăng ký thành công nhưng chưa có session (email confirmation, v.v.)
      return {
        success: true,
        redirect: "/login",
      }
    }

    return {
      success: false,
      message: "Registration failed. Please try again.",
    }
  } catch (error: unknown) {
    console.error("Registration error:", error)

    if (error instanceof Error) {
      const msg = error.message || ""

      if (msg.toLowerCase().includes("user already registered")) {
        return {
          success: false,
          message: "Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.",
        }
      }

      if (msg.toLowerCase().includes("too many requests") || msg.includes("429")) {
        return {
          success: false,
          message:
            "Bạn thao tác quá nhanh hoặc đã gửi quá nhiều yêu cầu. Vui lòng đợi vài giây rồi thử lại.",
        }
      }

      if (msg.toLowerCase().includes("unable to validate email address")) {
        return {
          success: false,
          message: "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại định dạng email.",
        }
      }

      return {
        success: false,
        message: msg || "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại.",
      }
    }

    return {
      success: false,
      message: "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại.",
    }
  }
}

// Get user chats action
export async function getUserChatsAction() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, message: "You must be logged in to view chats", chats: [] }
    }

    const chats = await getUserChats(user.id)
    return { success: true, chats }
  } catch (error) {
    console.error("Get user chats error:", error)
    return { 
      success: false, 
      message:
        "Đã xảy ra lỗi khi tải danh sách cuộc trò chuyện. Vui lòng thử lại sau.",
      chats: [] 
    }
  }
}

// Get all users action
export async function getAllUsersAction() {
  try {
    const users = await getAllUsers()
    return { success: true, users }
  } catch (error) {
    console.error("Get all users error:", error)
    return { 
      success: false, 
      message:
        "Đã xảy ra lỗi khi tải danh sách người dùng. Vui lòng thử lại sau.",
      users: [] 
    }
  }
}

// Logout action
export async function logout() {
  try {
    const user = await getCurrentUser()
    
    if (user) {
      // Set user as offline
      try {
        await updateUserPresence(user.id, false)
      } catch (error) {
        console.error("Error updating user presence:", error)
        // Continue with logout even if presence update fails
      }

      await logoutUser()
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Logout error:", error)
    return { 
      success: false, 
      message: "Đăng xuất thất bại. Vui lòng thử lại."
    }
  }
}

// Send message action
export async function sendMessageAction(formData: FormData) {
  try {
    const content = formData.get("content") as string
    const chatId = formData.get("chatId") as string

    if (!content || !chatId) {
      return { success: false, message: "Message content and chat ID are required" }
    }

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, message: "You must be logged in to send messages" }
    }

    const message = await sendMessage(content, chatId, user.id, user.username)

    revalidatePath(`/chat/${chatId}`)
    return { success: true, message }
  } catch (error) {
    console.error("Send message error:", error)
    return { 
      success: false, 
      message:
        "Đã xảy ra lỗi khi gửi tin nhắn. Vui lòng kiểm tra kết nối và thử lại.",
    }
  }
}

// Create chat action
export async function createChatAction(formData: FormData) {
  try {
    const name = formData.get("name") as string
    const isGroup = formData.get("isGroup") === "true"
    const membersInput = formData.get("members") as string

    if (!name) {
      return { success: false, message: "Chat name is required" }
    }

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, message: "You must be logged in to create a chat" }
    }

    let members: string[] = []
    if (membersInput) {
      members = membersInput.split(",").map((id) => id.trim())
    }

    const chat = await createChat(name, isGroup, user.id, members)

    revalidatePath("/chat")
    return { success: true, chat }
  } catch (error) {
    console.error("Create chat error:", error)
    return { 
      success: false, 
      message:
        "Đã xảy ra lỗi khi tạo cuộc trò chuyện mới. Vui lòng thử lại.",
    }
  }
}