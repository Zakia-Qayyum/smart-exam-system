export default function Navbar() {
  return (
    <nav className="bg-white shadow-md h-16 flex items-center justify-between px-6">

      <h1 className="text-xl font-bold text-blue-700">
        Smart Exam System
      </h1>

      <div className="flex items-center gap-4">

        <span className="text-gray-600">
          Welcome, Admin
        </span>

        <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">
          A
        </div>

      </div>

    </nav>
  );
}