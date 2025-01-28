import { supabase } from "@/lib/supabaseClient";
import OnboardClient from "./OnboardClient";

export default async function OnboardPage() {
  // Fetch the teams
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name");

  if (teamsError) {
    console.error("Error fetching teams:", teamsError);
    // In production, handle errors more gracefully
  }

  // For each team, fetch its users from the "profiles" table
  let teamsWithUsers = [];

  if (teams) {
    teamsWithUsers = await Promise.all(
      teams.map(async (team) => {
        const { data: users, error: usersError } = await supabase
          .from("profiles")
          .select("*")
          .eq("team", team.id);

        if (usersError) {
          console.error(`Error fetching users for team ${team.id}:`, usersError);
        }

        return {
          ...team,
          users: users || [],
        };
      })
    );
  }

  // Make it scrollable by not forcing a fixed height
  return (
    <div className="bg-gray-900 text-white w-full min-h-screen overflow-y-auto">
      {/* Floating nav menu in the top-left corner */}
      <nav className="fixed top-4 left-4 z-50 bg-gray-800 rounded-md shadow-lg border border-gray-700 p-2 w-40">
        <h2 className="text-md font-semibold mb-2">Navigation</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <a
              href="/protected/map"
              className="block rounded px-2 py-1 hover:bg-gray-700"
            >
              Back to Map
            </a>
          </li>
          <li>
            <a
              href="/protected/onboard"
              className="block rounded px-2 py-1 bg-gray-700"
            >
              Onboarding
            </a>
          </li>
        </ul>
      </nav>

      {/* Main Onboarding area */}
      <main className="pt-20 px-4 sm:px-6 lg:px-8 w-full">
        <h1 className="text-2xl font-semibold mb-6">Onboarding</h1>
        <OnboardClient teams={teamsWithUsers} />
      </main>
    </div>
  );
}
