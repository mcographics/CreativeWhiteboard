const menuItems = ["File", "Edit", "View", "Insert", "Arrange", "Tools", "Help"];

export function MenuBar() {
  return (
    <nav className="menu-bar" aria-label="Application menu">
      {menuItems.map((item) => <button key={item} type="button">{item}</button>)}
    </nav>
  );
}
