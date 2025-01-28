"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function OnboardClient({ teams }) {
  // Keep local state for the list of teams so we can update in real time
  const [teamList, setTeamList] = useState(teams || []);

  // Modal open/close states
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // State for "Add Team"
  const [newTeamName, setNewTeamName] = useState("");

  // State for "Add User"
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("123456");
  const [newUserTeamId, setNewUserTeamId] = useState("");

  // Handle "Add Team"
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) {
      alert("Please enter a team name.");
      return;
    }
    try {
      const response = await fetch("/api/addteam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert("Error adding team: " + (err.error || "Unknown error"));
        return;
      }

      const createdTeam = await response.json();

      // Update local state
      setTeamList((prev) => [...prev, { ...createdTeam, users: [] }]);
      setNewTeamName("");
      alert("Team added successfully!");
      setIsAddTeamOpen(false); // close modal
    } catch (error) {
      console.error("Error adding team:", error);
      alert("Error adding team. Check console for details.");
    }
  }

  // Handle "Add User"
  async function handleAddUser(e) {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserTeamId) {
      alert("Please provide an email and choose a team.");
      return;
    }
    try {
      const response = await fetch("/api/adduser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword.trim() || "123456",
          firstName: newUserFirstName.trim(),
          lastName: newUserLastName.trim(),
          phone: newUserPhone.trim(),
          team: parseInt(String(newUserTeamId), 10),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert("Error adding user: " + (err.error || "Unknown error"));
        return;
      }

      const createdUserData = await response.json();
      // Typically returns { user: {...} }; adjust if your endpoint differs

      const createdUserId =
        createdUserData.user?.id || createdUserData.user?.user?.id;

      // Build a new user record for display
      const newUserRecord = {
        id: createdUserId || Math.random().toString(36).substring(2),
        user_id: createdUserId,
        email: newUserEmail.trim(),
        first_name: newUserFirstName.trim(),
        last_name: newUserLastName.trim(),
        phone: newUserPhone.trim(),
        team: parseInt(String(newUserTeamId), 10),
      };

      setTeamList((prevTeams) =>
        prevTeams.map((team) => {
          if (team.id === parseInt(String(newUserTeamId), 10)) {
            return {
              ...team,
              users: [...team.users, newUserRecord],
            };
          }
          return team;
        })
      );

      // Reset form
      setNewUserEmail("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserPhone("");
      setNewUserPassword("123456");
      setNewUserTeamId("");
      alert("User added successfully!");
      setIsAddUserOpen(false); // close modal
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Error adding user. Check console for details.");
    }
  }

  return (
    <div className="bg-gray-900 w-full">
      {/* Buttons top-right to open modals */}
      <div className="absolute top-4 right-4 flex gap-3 z-50">
        <button
          onClick={() => setIsAddTeamOpen(true)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Add Team
        </button>
        <button
          onClick={() => setIsAddUserOpen(true)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Add User
        </button>
      </div>

      {/* Team & User lists */}
      <div className="py-10 px-4 sm:px-6 lg:px-8">
        {/* Top heading */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-base font-semibold text-white">
              Teams &amp; Users
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              A list of all the teams and their users, including name,
              email, phone, and IDs.
            </p>
          </div>
        </div>

        {/* Display all teams + users in tables */}
        <div className="mt-8 flow-root">
          {teamList.length === 0 ? (
            <p className="text-white">No teams found.</p>
          ) : (
            <div className="space-y-10">
              {teamList.map((team) => (
                <div key={team.id}>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Team: {team.name} (ID: {team.id})
                  </h3>
                  {team.users && team.users.length > 0 ? (
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                      <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <table className="min-w-full divide-y divide-gray-700">
                          <thead>
                            <tr>
                              <th
                                scope="col"
                                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-0"
                              >
                                Name
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3.5 text-left text-sm font-semibold text-white"
                              >
                                Email
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3.5 text-left text-sm font-semibold text-white"
                              >
                                Phone
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3.5 text-left text-sm font-semibold text-white"
                              >
                                User ID
                              </th>
                              <th
                                scope="col"
                                className="relative py-3.5 pl-3 pr-4 sm:pr-0"
                              >
                                <span className="sr-only">Edit</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {team.users.map((user) => (
                              <tr key={user.id}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-0">
                                  {user.first_name} {user.last_name}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                  {user.email}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                  {user.phone}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                  {user.user_id || user.id}
                                </td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                  <a
                                    href="#"
                                    className="text-indigo-400 hover:text-indigo-300"
                                  >
                                    Edit
                                    <span className="sr-only">
                                      , {user.email}
                                    </span>
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">
                      No users in this team yet.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Add Team */}
      <Dialog
        open={isAddTeamOpen}
        onClose={setIsAddTeamOpen}
        className="relative z-50"
      >
        {/* Backdrop */}
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity"
        />
        {/* Centered container */}
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
            >
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setIsAddTeamOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <DialogTitle as="h3" className="text-lg font-medium text-gray-900">
                Add a New Team
              </DialogTitle>
              <div className="mt-3">
                <form onSubmit={handleAddTeam} className="flex flex-col gap-2">
                  <label
                    htmlFor="team_name"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Team Name
                  </label>
                  <input
                    id="team_name"
                    name="team_name"
                    type="text"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    className="mt-4 inline-flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    Add Team
                  </button>
                </form>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Add User */}
      <Dialog
        open={isAddUserOpen}
        onClose={setIsAddUserOpen}
        className="relative z-50"
      >
        {/* Backdrop */}
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity"
        />
        {/* Centered container */}
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
            >
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setIsAddUserOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <DialogTitle as="h3" className="text-lg font-medium text-gray-900">
                Add a New User
              </DialogTitle>
              <div className="mt-3">
                <form onSubmit={handleAddUser} className="flex flex-col gap-2">
                  <label
                    htmlFor="user_email"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="user_email"
                    name="user_email"
                    type="email"
                    placeholder="you@example.com"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />

                  <label
                    htmlFor="first_name"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                  />

                  <label
                    htmlFor="last_name"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                  />

                  <label
                    htmlFor="phone"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                  />

                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="text"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />

                  <label
                    htmlFor="team_id"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Select Team
                  </label>
                  <select
                    id="team_id"
                    name="team_id"
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    value={newUserTeamId}
                    onChange={(e) => setNewUserTeamId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      -- Choose a team --
                    </option>
                    {teamList.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} (ID: {team.id})
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="mt-4 inline-flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    Add User
                  </button>
                </form>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
