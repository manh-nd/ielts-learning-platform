import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chilly IELTS - Luyện thi IELTS Thông minh cùng AI & Giảng viên",
  description:
    "Nền tảng luyện thi IELTS thông minh kết hợp đàm thoại AI thời gian thực (Speaking), chẩn đoán lỗi đa tiêu chí (Writing) và không gian chấm chữa chuyên sâu từ Giảng viên.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
