"use client";

export default function Toolbar({
  isDrawingMode = false,
  onPan,
  onFilterLeads,
  onToggleTerritoryMode,
  onAssignLeads,
  onCreateLead
}) {
  // No Supabase interaction here, no changes needed.
  
  const buttons = [
    {
      icon: "/pan.png",
      alt: "Pan",
      tooltip: "Pan",
      event: onPan,
      class: "w-10 h-10 bg-blue-600"
    },
    {
      icon: "/filter.png",
      alt: "Filter Leads",
      tooltip: "Filter Leads",
      event: onFilterLeads,
      class: "w-8 h-8 bg-gray-600"
    },
    {
      icon: "/territory.png",
      alt: "Territory",
      tooltip: "Territory",
      event: onToggleTerritoryMode,
      class: "w-8 h-8 bg-gray-600"
    },
    {
      icon: "/assign.png",
      alt: "Assign Leads",
      tooltip: "Assign Leads",
      event: onAssignLeads,
      class: "w-8 h-8 bg-gray-600"
    },
    {
      icon: "/newpin.png",
      alt: "Create Lead",
      tooltip: "Create Lead",
      event: onCreateLead,
      class: "w-8 h-8 bg-gray-600"
    }
  ];

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white flex items-center justify-between w-[400px] h-12 rounded-full shadow-lg px-4">
      {buttons.map((button, index) => (
        <div key={index} className="relative">
          <button
            className={`flex items-center justify-center ${button.class} rounded-full focus:outline-none`}
            onClick={button.event}
          >
            <img
              src={button.icon}
              alt={button.alt}
              className={button.icon === "/pan.png" ? "h-6 w-6" : "h-4 w-4"}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
