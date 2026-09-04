import { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/authorization";
import {
  getTeacherClassrooms,
  getClassroomRoster,
} from "@/modules/classroom/application/classroom-service";
import { ClassroomManager } from "@/components/classroom/classroom-manager";

export const metadata: Metadata = {
  title: "Quản lý Lớp học | Chilly IELTS",
  description:
    "Quản lý danh sách lớp học, học viên và phân phối bài tập Speaking.",
};

export default async function TeacherClassroomsPage() {
  const session = await requireRoleOrRedirect("teacher");

  // Fetch initial classrooms on server
  const classrooms = await getTeacherClassrooms(session.user.id);

  // Fetch initial roster for first classroom if available
  const initialMembers =
    classrooms.length > 0
      ? await getClassroomRoster(session.user.id, classrooms[0].id)
      : [];

  return (
    <div className="w-full py-2">
      <ClassroomManager
        initialClassrooms={classrooms}
        initialMembers={initialMembers}
      />
    </div>
  );
}
