export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-blue-900 text-white p-6">

      <h2 className="text-2xl font-bold mb-10">
        AU Portal
      </h2>

      <ul className="space-y-5">

        <li className="hover:text-yellow-300 cursor-pointer">
          Dashboard
        </li>

        <li className="hover:text-yellow-300 cursor-pointer">
          Exam Scheduling
        </li>

        <li className="hover:text-yellow-300 cursor-pointer">
          Invigilators
        </li>

        <li className="hover:text-yellow-300 cursor-pointer">
          Timetable
        </li>

        <li className="hover:text-yellow-300 cursor-pointer">
          Reports
        </li>

        <li className="hover:text-yellow-300 cursor-pointer">
          Settings
        </li>

      </ul>

    </aside>
  );
}