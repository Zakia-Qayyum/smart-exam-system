import Navbar from "@/components/Navbar/Navbar";
import Sidebar from "@/components/Sidebar/Sidebar";
import DashboardCard from "@/components/Cards/DashboardCard";

export default function Dashboard() {
  return (
    <div className="flex">

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 bg-gray-100 min-h-screen">

        <Navbar />

        <div className="p-8">

          <h1 className="text-3xl font-bold mb-8">
            Dashboard
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            <DashboardCard
              title="Total Exams"
              value="45"
            />

            <DashboardCard
              title="Invigilators"
              value="120"
            />

            <DashboardCard
              title="Students"
              value="1800"
            />

            <DashboardCard
              title="Today's Exams"
              value="12"
            />

          </div>

        </div>

      </div>

    </div>
  );
}