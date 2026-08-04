export default function LoginPage() {
  return (
    <div className="min-h-screen flex">

      {/* Left Side */}

      <div className="hidden md:flex w-1/2 bg-blue-900 text-white items-center justify-center p-10">

        <div className="text-center">

          <img
            src="/au-logo.png"
            alt="Air University"
            className="w-40 mx-auto mb-6"
          />

          <h1 className="text-4xl font-bold mb-5">
            Smart Exam Scheduling &
            <br />
            Invigilation Management System
          </h1>

          <p className="text-blue-100 text-lg">
            Air University
          </p>

        </div>

      </div>

      {/* Right Side */}

      <div className="flex w-full md:w-1/2 justify-center items-center bg-gray-100">

        <div className="bg-white p-10 rounded-xl shadow-xl w-[420px]">

          <div className="text-center mb-8">

            <img
              src="/au-logo.png"
              alt="AU"
              className="w-24 mx-auto mb-3"
            />

            <h2 className="text-3xl font-bold text-blue-900">
              Welcome Back
            </h2>

            <p className="text-gray-500">
              Sign in to continue
            </p>

          </div>

          <form className="space-y-5">

            <input
              type="email"
              placeholder="Email"
              className="w-full border rounded-lg p-3"
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full border rounded-lg p-3"
            />

            <div className="flex justify-between text-sm">

              <label>

                <input
                  type="checkbox"
                  className="mr-2"
                />

                Remember me

              </label>

              <a
                href="#"
                className="text-blue-700"
              >
                Forgot Password?
              </a>

            </div>

            <button
              className="w-full bg-blue-800 text-white rounded-lg p-3 hover:bg-blue-900 transition"
            >
              Login
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}