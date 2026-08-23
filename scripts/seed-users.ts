import { auth } from "@/lib/auth";
import { db, client } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resolveUserRole } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

export interface DevSeedUser {
  name: string;
  email: string;
  password: string;
  expectedRole: "teacher" | "learner";
}

export const DEV_SAMPLE_USERS: DevSeedUser[] = [
  {
    name: "IELTS Teacher",
    email: "teacher@ielts.liuhocngoaingu.com",
    password: "Password123!",
    expectedRole: "teacher",
  },
  {
    name: "Dual Learner Teacher",
    email: "learnerteacher@ielts.liuhocngoaingu.com",
    password: "Password123!",
    expectedRole: "teacher",
  },
  {
    name: "Teacher Dev",
    email: "teacher@ielts-prep.vn",
    password: "Password123!",
    expectedRole: "teacher",
  },
  {
    name: "Learner Dev",
    email: "learner@ielts-prep.vn",
    password: "Password123!",
    expectedRole: "learner",
  },
  {
    name: "IELTS Learner",
    email: "learner@ielts.liuhocngoaingu.com",
    password: "Password123!",
    expectedRole: "learner",
  },
];

export async function seedUsers(users: DevSeedUser[] = DEV_SAMPLE_USERS) {
  console.log("🌱 [Seed] Bắt đầu khởi tạo tài khoản dev mẫu...");

  const results: Array<{
    name: string;
    email: string;
    role: string;
    status: "created" | "updated" | "exists";
    passwordHint: string;
  }> = [];

  for (const item of users) {
    const targetRole = resolveUserRole(item.email);

    try {
      // 1. Check if user already exists in database
      const existingUsers = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, item.email.toLowerCase()));

      if (existingUsers.length > 0) {
        const existing = existingUsers[0];
        // Ensure role is correctly synchronized
        if (existing.role !== targetRole || !existing.emailVerified) {
          await db
            .update(schema.user)
            .set({
              role: targetRole,
              emailVerified: true,
              updatedAt: new Date(),
            })
            .where(eq(schema.user.id, existing.id));
          results.push({
            name: item.name,
            email: item.email,
            role: targetRole,
            status: "updated",
            passwordHint: item.password,
          });
        } else {
          results.push({
            name: item.name,
            email: item.email,
            role: targetRole,
            status: "exists",
            passwordHint: item.password,
          });
        }
        continue;
      }

      // 2. Create new user via Better Auth API
      const result = await auth.api.signUpEmail({
        body: {
          email: item.email,
          password: item.password,
          name: item.name,
        },
      });

      if (result?.user) {
        // Ensure emailVerified is true for dev accounts
        await db
          .update(schema.user)
          .set({
            emailVerified: true,
            role: targetRole,
          })
          .where(eq(schema.user.id, result.user.id));

        results.push({
          name: item.name,
          email: item.email,
          role: targetRole,
          status: "created",
          passwordHint: item.password,
        });
      }
    } catch (error: unknown) {
      console.warn(
        `⚠️ [Seed] Lỗi khi tạo tài khoản ${item.email}:`,
        (error as Error)?.message || error
      );
    }
  }

  console.log("\n============================================================");
  console.log("✅ [Seed] Kết quả khởi tạo tài khoản dev mẫu:");
  console.log("============================================================");
  console.table(
    results.map((r) => ({
      "Tên người dùng": r.name,
      "Email đăng nhập": r.email,
      "Mật khẩu": r.passwordHint,
      "Vai trò": r.role === "teacher" ? "Giáo viên 🎓" : "Học viên 📚",
      "Trạng thái": r.status,
    }))
  );
  console.log("============================================================\n");

  return results;
}

// Execute directly if run via CLI
if (import.meta.main) {
  seedUsers()
    .then(async () => {
      await client.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ [Seed] Thất bại:", err);
      await client.end();
      process.exit(1);
    });
}
