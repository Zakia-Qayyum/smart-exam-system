export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center">

      <div className="bg-white shadow-2xl rounded-2xl p-12 w-[90%] max-w-3xl text-center">

        <h1 className="text-5xl font-bold text-blue-700">
          Smart Exam Scheduling
          <br />
          & Invigilation Management System
        </h1>

        <p className="mt-6 text-xl text-gray-600">
          Air University
        </p>

        <p className="mt-2 text-gray-500">
          NCSA Internship Project
        </p>

        <button className="mt-10 bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-lg text-lg">
          Get Started
        </button>

      </div>

    </main>
  );
}