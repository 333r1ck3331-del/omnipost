import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "灵感生成", end: true },
  { to: "/library", label: "内容库" },
  { to: "/crawl", label: "信息爬取" },
  { to: "/review", label: "审核队列" },
  { to: "/settings", label: "设置" },
];

export default function TopNav() {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-8 flex items-center gap-1 h-14">
        <div className="font-semibold text-gray-900 mr-6">OmniPost</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded text-sm transition ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
