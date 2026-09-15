function PlaceholderPage({
  title,
  description = "This admin section is reserved for a later phase.",
}) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export default PlaceholderPage;
