import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')

// Parse .env file manually
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxsrydtrpqcxchpairbw.supabase.co'
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = env.ADMIN_EMAIL || 'admin@example.com'
const adminPassword = env.ADMIN_PASSWORD || 'viu123456789'

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Also connect via pg pooler for DDL operations
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
})

async function runSQL(sql) {
  const client = await pool.connect()
  try {
    await client.query(sql)
  } finally {
    client.release()
  }
}

const SEED_USERS = [
  { email: adminEmail, password: adminPassword, username: 'admin', role: 'admin', color: '#FF6B6B' },
  { email: 'alice@test.com', password: '123456', username: 'Alice Nguyen', role: 'user', color: '#4ECDC4' },
  { email: 'bob@test.com', password: '123456', username: 'Bob Tran', role: 'user', color: '#45B7D1' },
  { email: 'charlie@test.com', password: '123456', username: 'Charlie Le', role: 'user', color: '#96CEB4' },
  { email: 'diana@test.com', password: '123456', username: 'Diana Pham', role: 'user', color: '#FFEEAD' },
  { email: 'eve@test.com', password: '123456', username: 'Eve Hoang', role: 'user', color: '#D4A5A5' },
  { email: 'frank@test.com', password: '123456', username: 'Frank Vu', role: 'user', color: '#A29BFE' },
  { email: 'grace@test.com', password: '123456', username: 'Grace Ly', role: 'user', color: '#FD79A8' },
  { email: 'henry@test.com', password: '123456', username: 'Henry Do', role: 'user', color: '#00CEC9' },
  { email: 'ivy@test.com', password: '123456', username: 'Ivy Ngo', role: 'user', color: '#E17055' },
]

async function createUser(userInfo) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: userInfo.email,
    password: userInfo.password,
    email_confirm: true,
    user_metadata: { username: userInfo.username, role: userInfo.role },
  })
  if (error) {
    if (error.message?.toLowerCase().includes('already exists') || error.message?.toLowerCase().includes('already been registered')) {
      const { data: users } = await supabase.auth.admin.listUsers()
      const existing = users?.users?.find(u => u.email === userInfo.email)
      if (existing) {
        console.log(`  User already exists: ${userInfo.username} (${existing.id})`)
        return existing
      }
    }
    console.error(`  Error creating ${userInfo.username}:`, error.message)
    return null
  }
  console.log(`  Created: ${userInfo.username} (${data.user.id})`)
  return data.user
}

async function createProfile(userId, info) {
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    username: info.username,
    full_name: info.username,
    role: info.role,
    avatar_url: '',
    avatar_color: info.color,
    profile_color: info.color,
    is_online: true,
    last_seen: new Date().toISOString(),
  }, { onConflict: 'user_id', ignoreDuplicates: false })
  if (error) console.error(`  Error creating profile for ${info.username}:`, error.message)
  else console.log(`  Profile created for ${info.username}`)
}

async function createChat(name, isGroup, createdBy, members, icon) {
  // Ensure creator is always in members
  const allMembers = Array.from(new Set([...members, createdBy]))
  const { data, error } = await supabase.from('chats').insert({
    name,
    is_group: isGroup,
    created_by: createdBy,
    members: allMembers,
    icon: icon || null,
    theme: ['default', 'blue', 'purple', 'green', 'red', 'yellow', 'pink'][Math.floor(Math.random() * 7)],
    created_at: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single()

  if (error) {
    console.error(`  Error creating chat "${name}":`, error.message)
    return null
  }
  console.log(`  Chat created: "${name}" (${data.id})`)
  return data
}

async function createMessage(chatId, senderId, senderName, content, timestamp, options) {
  const { data, error } = await supabase.from('messages').insert({
    chatId,
    senderId,
    senderName,
    content,
    timestamp: timestamp || Date.now(),
    readBy: [senderId],
    edited: options?.edited || false,
    deleted: options?.deleted || false,
    fileUrl: options?.fileUrl || null,
    fileName: options?.fileName || null,
    replyTo: options?.replyTo || null,
  }).select().single()

  if (error) {
    console.error(`  Error creating message:`, error.message)
    return null
  }
  return data
}

async function createNotification(userId, chatId, messageId, senderName, content, read) {
  if (!chatId) return
  const { error } = await supabase.from('notifications').insert({
    userId,
    chatId,
    messageId: messageId || null,
    senderName,
    content,
    timestamp: Date.now(),
    read,
  })
  if (error) console.error(`  Error creating notification:`, error.message)
}

async function updateLastMessage(chatId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('chatId', chatId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data) {
    await supabase.from('chats').update({ last_message: data }).eq('id', chatId)
  }
}

async function main() {
  console.log('=== SEEDING DATABASE ===\n')

  // Step 0: Drop and recreate all tables
  console.log('0. Recreating tables...')
  await runSQL('DROP TABLE IF EXISTS public.notifications CASCADE')
  await runSQL('DROP TABLE IF EXISTS public.messages CASCADE')
  await runSQL('DROP TABLE IF EXISTS public.chats CASCADE')
  await runSQL('DROP TABLE IF EXISTS public.profiles CASCADE')

  await runSQL(`
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#8B5CF6',
      role TEXT NOT NULL DEFAULT 'user',
      profile_color TEXT,
      bio TEXT,
      birthday TEXT,
      address TEXT,
      is_online BOOLEAN DEFAULT false,
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await runSQL(`
    CREATE TABLE public.chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      is_group BOOLEAN DEFAULT false,
      created_by UUID,
      members JSONB DEFAULT '[]'::jsonb,
      icon TEXT,
      theme TEXT DEFAULT 'default',
      last_message JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await runSQL(`
    CREATE TABLE public.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "chatId" UUID NOT NULL,
      "senderId" UUID NOT NULL,
      "senderName" TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      type TEXT DEFAULT 'text',
      "fileUrl" TEXT,
      "fileName" TEXT,
      "replyTo" UUID,
      "isPinned" BOOLEAN DEFAULT false,
      edited BOOLEAN DEFAULT false,
      deleted BOOLEAN DEFAULT false,
      "readBy" JSONB DEFAULT '[]'::jsonb,
      reactions JSONB DEFAULT '{}'::jsonb,
      timestamp BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await runSQL(`
    CREATE TABLE public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL,
      "chatId" UUID,
      "messageId" UUID,
      "senderName" TEXT NOT NULL DEFAULT '',
      type TEXT DEFAULT 'message',
      content TEXT NOT NULL DEFAULT '',
      timestamp BIGINT NOT NULL,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Reload PostgREST schema cache
  try {
    await runSQL("NOTIFY pgrst, 'reload schema'")
    console.log('  Schema cache reloaded')
  } catch (e) {
    console.log('  (could not reload schema cache)')
  }
  console.log('  Tables ready')

  // Step 1: Create users
  console.log('\n1. Creating users...')
  const createdUsers = []
  for (const u of SEED_USERS) {
    const user = await createUser(u)
    if (user) {
      createdUsers.push({ ...u, id: user.id })
      await createProfile(user.id, u)
    }
  }

  if (createdUsers.length < 2) {
    console.log('\nNeed at least 2 users to seed chats. Exiting.')
    return
  }

  // Step 2: Create chats
  console.log('\n2. Creating chats...')

  const u = (i) => createdUsers[i]
  const all = () => createdUsers.map(x => x.id)

  const cAliceBob    = await createChat('Alice & Bob', false, u(0).id, [u(0).id, u(1).id, u(2).id])
  const cAliceCharlie= await createChat('Alice & Charlie', false, u(0).id, [u(0).id, u(1).id, u(3).id])
  const cDianaEve    = await createChat('Diana & Eve', false, u(0).id, [u(0).id, u(4).id, u(5).id])
  const cTeamDev     = await createChat('Team Dev', true, u(0).id, [u(0).id, u(1).id, u(2).id, u(3).id])
  const cFrankGrace  = await createChat('Frank & Grace', false, u(0).id, [u(0).id, u(6).id, u(7).id])
  const cHenryIvy    = await createChat('Henry & Ivy', false, u(0).id, [u(0).id, u(8).id, u(9).id])
  const cDesignTeam  = await createChat('Design Team', true, u(0).id, [u(0).id, u(4).id, u(5).id, u(7).id])
  const cMusicGroup  = await createChat('Music Lovers', true, u(0).id, [u(0).id, u(5).id, u(6).id, u(8).id, u(9).id])
  const cTravel      = await createChat('Du lịch cuối tuần', true, u(0).id, [u(0).id, u(2).id, u(3).id, u(4).id, u(6).id])
  const cCooking     = await createChat('Nấu ăn mỗi ngày', true, u(0).id, [u(0).id, u(1).id, u(3).id, u(5).id, u(7).id, u(9).id])

  const allChats = [cAliceBob, cAliceCharlie, cDianaEve, cTeamDev, cFrankGrace, cHenryIvy, cDesignTeam, cMusicGroup, cTravel, cCooking].filter(Boolean)

  // Step 3: Create messages
  console.log('\n3. Creating messages...')

  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const HOUR = 60 * 60 * 1000

  // --- Alice & Bob ---
  if (cAliceBob) {
    await createMessage(cAliceBob.id, u(1).id, u(1).username, 'Chào Bob, dạo này thế nào?', now - 3 * DAY)
    await createMessage(cAliceBob.id, u(2).id, u(2).username, 'Chào Alice! Mình vẫn ổn, cảm ơn bạn.', now - 3 * DAY + 60000)
    await createMessage(cAliceBob.id, u(1).id, u(1).username, 'Mình cũng tốt. Tuần này đi cà phê không?', now - 3 * DAY + 120000)
    await createMessage(cAliceBob.id, u(2).id, u(2).username, 'Ok bạn, thứ 7 nhé!', now - 3 * DAY + 180000)
    await createMessage(cAliceBob.id, u(1).id, u(1).username, 'Hẹn 10h sáng tại The Coffee House nhé!', now - 2 * DAY)
    await createMessage(cAliceBob.id, u(2).id, u(2).username, 'Đồng ý! See you 😄', now - 2 * DAY + 30000)
    await createMessage(cAliceBob.id, u(1).id, u(1).username, 'Bạn đã xem bộ phim mới chưa? Hay lắm!', now - 1 * DAY)
    await createMessage(cAliceBob.id, u(2).id, u(2).username, 'Chưa, cuối tuần này mình sẽ xem thử', now - 1 * DAY + 60000)
    await createMessage(cAliceBob.id, u(1).id, u(1).username, 'Tuyệt vời! 🎬', now - 1 * DAY + 120000)
    await updateLastMessage(cAliceBob.id)
  }

  // --- Alice & Charlie ---
  if (cAliceCharlie) {
    await createMessage(cAliceCharlie.id, u(1).id, u(1).username, 'Charlie, dự án React tuần này tiến triển sao rồi?', now - 2 * DAY)
    await createMessage(cAliceCharlie.id, u(3).id, u(3).username, 'Sắp xong rồi, đang test UI. Tối mai deploy lên Vercel thử.', now - 2 * DAY + 120000)
    await createMessage(cAliceCharlie.id, u(1).id, u(1).username, 'Hay quá! Cho mình xem link khi deploy nhé.', now - 2 * DAY + 240000)
    await createMessage(cAliceCharlie.id, u(3).id, u(3).username, 'Chắc chắn rồi! 👨‍💻', now - 1 * DAY)
    await createMessage(cAliceCharlie.id, u(1).id, u(1).username, 'Ok bạn! Mình review giúp cho.', now - 1 * DAY + 60000)
    await updateLastMessage(cAliceCharlie.id)
  }

  // --- Diana & Eve ---
  if (cDianaEve) {
    await createMessage(cDianaEve.id, u(4).id, u(4).username, 'Ê Eve, tụi mình đi ăn tối nay không?', now - 12 * HOUR)
    await createMessage(cDianaEve.id, u(5).id, u(5).username, 'Đi chứ! 7h tối quán cũ nhé?', now - 12 * HOUR + 60000)
    await createMessage(cDianaEve.id, u(4).id, u(4).username, 'Ok! Hẹn nhau ở đó 😋', now - 12 * HOUR + 120000)
    await createMessage(cDianaEve.id, u(5).id, u(5).username, 'Nhớ gọi phần bánh tráng trộn nha!', now - 12 * HOUR + 180000)
    await createMessage(cDianaEve.id, u(4).id, u(4).username, 'Tất nhiên rồi, phần đó ngon nhất quán 😍', now - 12 * HOUR + 240000)
    await updateLastMessage(cDianaEve.id)
  }

  // --- Team Dev ---
  if (cTeamDev) {
    await createMessage(cTeamDev.id, u(0).id, u(0).username, 'Chào cả team! Tuần này chúng ta sẽ review code vào thứ 6 nhé.', now - 4 * DAY)
    await createMessage(cTeamDev.id, u(1).id, u(1).username, 'Vâng anh! Em đã push xong branch feature/login rồi ạ.', now - 4 * DAY + 60000)
    await createMessage(cTeamDev.id, u(2).id, u(2).username, 'Em cũng sắp xong phần chat UI. Cần thêm 2 ngày nữa.', now - 4 * DAY + 120000)
    await createMessage(cTeamDev.id, u(3).id, u(3).username, 'Phần database em đã setup xong. Mọi người pull nhánh mới nhé.', now - 4 * DAY + 180000)
    await createMessage(cTeamDev.id, u(0).id, u(0).username, 'Tốt! Thứ 6 10h sáng meeting nhé. Ai vắng mặt báo trước.', now - 3 * DAY)
    await createMessage(cTeamDev.id, u(1).id, u(1).username, 'Có mặt ạ!', now - 3 * DAY + 60000)
    await createMessage(cTeamDev.id, u(2).id, u(2).username, 'Có mặt!', now - 3 * DAY + 120000)
    await createMessage(cTeamDev.id, u(0).id, u(0).username, 'File thiết kế mới đã upload lên Figma, mọi người xem nhé.', now - 1 * DAY, { fileUrl: 'https://www.figma.com/file/example', fileName: 'Figma Design v2' })
    await createMessage(cTeamDev.id, u(1).id, u(1).username, 'Đẹp quá anh ơi! Màu sắc này hợp lý hơn bản cũ nhiều.', now - 1 * DAY + 30000)
    await createMessage(cTeamDev.id, u(3).id, u(3).username, 'Có thay đổi gì về schema không ạ?', now - 1 * DAY + 60000)
    await createMessage(cTeamDev.id, u(0).id, u(0).username, 'Có! Thêm bảng chat_members và reports. Chiều nay anh sẽ update doc.', now - 1 * DAY + 120000)
    await updateLastMessage(cTeamDev.id)
  }

  // --- Frank & Grace ---
  if (cFrankGrace) {
    await createMessage(cFrankGrace.id, u(6).id, u(6).username, 'Grace ơi, cuối tuần này rảnh không? Đi chơi đâu đó không?', now - 2 * DAY)
    await createMessage(cFrankGrace.id, u(7).id, u(7).username, 'Rảnh bạn! Đi Đà Lạt không? Mình thấy vé máy bay đang rẻ.', now - 2 * DAY + 60000)
    await createMessage(cFrankGrace.id, u(6).id, u(6).username, 'Oh hay đấy! Bao nhiêu một vé?', now - 2 * DAY + 120000)
    await createMessage(cFrankGrace.id, u(7).id, u(7).username, 'Tầm 1tr5 khứ hồi thôi. Ở homestay mình quen.', now - 2 * DAY + 180000)
    await createMessage(cFrankGrace.id, u(6).id, u(6).username, 'Ok luôn! Book đi bạn ơi 🤩', now - 2 * DAY + 240000)
    await createMessage(cFrankGrace.id, u(7).id, u(7).username, 'Sáng thứ 7 bay nha! Mình sẽ lo vé.', now - 1 * DAY)
    await updateLastMessage(cFrankGrace.id)
  }

  // --- Henry & Ivy ---
  if (cHenryIvy) {
    await createMessage(cHenryIvy.id, u(8).id, u(8).username, 'Ivy ơi, tối nay có concert của Hoàng Thùy Linh, đi không?', now - 1 * DAY)
    await createMessage(cHenryIvy.id, u(9).id, u(9).username, 'Trời ơi mê quá! Còn vé không bạn?', now - 1 * DAY + 30000)
    await createMessage(cHenryIvy.id, u(8).id, u(8).username, 'Còn nè, mình mua 2 vé rồi. Ghế VIP luôn 😎', now - 1 * DAY + 60000)
    await createMessage(cHenryIvy.id, u(9).id, u(9).username, 'Tuyệt vời!!! Mấy giờ bắt đầu?', now - 1 * DAY + 90000)
    await createMessage(cHenryIvy.id, u(8).id, u(8).username, '7h30 tối, mình qua đón Ivy nha!', now - 1 * DAY + 120000)
    await createMessage(cHenryIvy.id, u(9).id, u(9).username, 'Ok hẹn 6h45 ở nhà Ivy nhé! 🎵', now - 1 * DAY + 150000)
    await updateLastMessage(cHenryIvy.id)
  }

  // --- Design Team ---
  if (cDesignTeam) {
    await createMessage(cDesignTeam.id, u(7).id, u(7).username, 'Mọi người ơi, bên marketing gửi brief mới rồi!', now - 3 * DAY)
    await createMessage(cDesignTeam.id, u(4).id, u(4).username, 'Để mình xem qua. Có gì thay đổi lớn không Grace?', now - 3 * DAY + 60000)
    await createMessage(cDesignTeam.id, u(7).id, u(7).username, 'Họ muốn đổi màu chủ đạo từ xanh sang cam. Hơi đau đầu 😅', now - 3 * DAY + 120000)
    await createMessage(cDesignTeam.id, u(5).id, u(5).username, 'Cam cũng được mà, miễn là tone pastel.', now - 3 * DAY + 180000)
    await createMessage(cDesignTeam.id, u(0).id, u(0).username, 'Để tối nay anh research thử vài palette, mai mình bàn nhé.', now - 3 * DAY + 240000)
    await createMessage(cDesignTeam.id, u(7).id, u(7).username, 'Vâng ạ! Em cũng đang làm mood board.', now - 2 * DAY)
    await createMessage(cDesignTeam.id, u(4).id, u(4).username, 'Ui chị Grace ơi, em gửi em ảnh mẫu tham khảo nha!', now - 2 * DAY + 60000, { fileUrl: 'https://dribbble.com/shots/example', fileName: 'Dribbble Reference' })
    await createMessage(cDesignTeam.id, u(7).id, u(7).username, 'Cảm ơn Diana. Mọi người xem xong rồi vote nhé!', now - 2 * DAY + 120000)
    await updateLastMessage(cDesignTeam.id)
  }

  // --- Music Lovers ---
  if (cMusicGroup) {
    await createMessage(cMusicGroup.id, u(5).id, u(5).username, 'Mọi người có nghe album mới của Văn Mai Hương chưa?', now - 5 * DAY)
    await createMessage(cMusicGroup.id, u(6).id, u(6).username, 'Nghe rồi! Hay dã man. Bài "Mưa Tháng Sáu" nghe ghiền lắm.', now - 5 * DAY + 60000)
    await createMessage(cMusicGroup.id, u(8).id, u(8).username, 'Mình thích bài "Một Ngày Mưa" hơn. Giai điệu nhẹ nhàng.', now - 5 * DAY + 120000)
    await createMessage(cMusicGroup.id, u(9).id, u(9).username, 'Tối nay quẩy không? Mình vừa mua loa mới 😂', now - 4 * DAY)
    await createMessage(cMusicGroup.id, u(5).id, u(5).username, 'Yes! Đem qua nhà mình đi, không gian rộng.', now - 4 * DAY + 60000)
    await createMessage(cMusicGroup.id, u(6).id, u(6).username, 'Mang theo guitar nữa nha!', now - 4 * DAY + 120000)
    await createMessage(cMusicGroup.id, u(8).id, u(8).username, 'Quẩy tới bến! 🎸🎶', now - 4 * DAY + 180000)
    await updateLastMessage(cMusicGroup.id)
  }

  // --- Du lịch cuối tuần ---
  if (cTravel) {
    await createMessage(cTravel.id, u(2).id, u(2).username, 'Mọi người ơi, cuối tháng này nghỉ lễ 30/4, đi đâu chơi không?', now - 6 * DAY)
    await createMessage(cTravel.id, u(3).id, u(3).username, 'Đi Phú Quốc đi! Mấy nay biển đẹp lắm.', now - 6 * DAY + 60000)
    await createMessage(cTravel.id, u(4).id, u(4).username, 'Ok đó, nhưng đặt sớm không hết vé. Tuần trước mình xem đã tăng giá rồi.', now - 6 * DAY + 120000)
    await createMessage(cTravel.id, u(6).id, u(6).username, 'Mình có quen bên travel, để mình hỏi giá tour đoàn xem.', now - 6 * DAY + 180000)
    await createMessage(cTravel.id, u(2).id, u(2).username, 'Tuyệt! Khoảng 5-6 người là vừa. Ai đi nữa không?', now - 5 * DAY)
    await createMessage(cTravel.id, u(3).id, u(3).username, 'Mình rủ thêm Frank với Grace nữa cho vui.', now - 5 * DAY + 60000)
    await createMessage(cTravel.id, u(6).id, u(6).username, 'Để mình hỏi Grace. Mà đi mấy ngày?', now - 5 * DAY + 120000)
    await createMessage(cTravel.id, u(2).id, u(2).username, 'Dự tính 3 ngày 2 đêm, mùng 30 tới mùng 2.', now - 5 * DAY + 180000)
    await createMessage(cTravel.id, u(4).id, u(4).username, 'Ok để mình xin phép công ty sớm! ✈️', now - 4 * DAY)
    await updateLastMessage(cTravel.id)
  }

  // --- Nấu ăn mỗi ngày ---
  if (cCooking) {
    await createMessage(cCooking.id, u(9).id, u(9).username, 'Chào mọi người! Hôm nay ai có công thức món mới không?', now - 3 * DAY)
    await createMessage(cCooking.id, u(1).id, u(1).username, 'Mình vừa thử làm bánh flan bằng nồi chiên không dầu, ngon bất ngờ!', now - 3 * DAY + 30000)
    await createMessage(cCooking.id, u(3).id, u(3).username, 'Công thức đi Alice ơi! Mình thèm flan quá 😋', now - 3 * DAY + 60000)
    await createMessage(cCooking.id, u(1).id, u(1).username, '5 trứng, 1 hộp sữa đặc, 500ml sữa tươi, 100gr đường. 150 độ 45 phút nha!', now - 3 * DAY + 90000)
    await createMessage(cCooking.id, u(5).id, u(5).username, 'Chiều nay mình thử liền. Cảm ơn Alice nha!', now - 3 * DAY + 120000)
    await createMessage(cCooking.id, u(7).id, u(7).username, 'Hôm qua mình nấu lẩu Thái, cả nhà khen hết lời 😆', now - 2 * DAY)
    await createMessage(cCooking.id, u(9).id, u(9).username, 'Chia sẻ công thức lẩu đi Grace ơi!', now - 2 * DAY + 30000)
    await createMessage(cCooking.id, u(7).id, u(7).username, 'Sả ớt băm, me, nước cốt dừa, tôm, mực, nấm. Nấu 20p là xong!', now - 2 * DAY + 60000)
    await createMessage(cCooking.id, u(3).id, u(3).username, 'Cuối tuần này hội ngộ nấu ăn không mọi người?', now - 1 * DAY)
    await createMessage(cCooking.id, u(9).id, u(9).username, 'Đồng ý! Nhà mình rộng, tụ tập ở đây nha! 🍳', now - 1 * DAY + 30000)
    await updateLastMessage(cCooking.id)
  }

  // Update last_message for all chats
  for (const chat of allChats) {
    await updateLastMessage(chat.id)
  }

  // Step 4: Summary
  console.log('\n=== SEED COMPLETE ===')
  console.log('Users created:', createdUsers.length)
  console.log('Chats created:', allChats.length)
  console.log('\nLogin credentials:')
  for (const u of SEED_USERS) {
    console.log('  ' + u.username + ': ' + u.email + ' / ' + u.password)
  }

  await pool.end()
}

main().catch(console.error)
