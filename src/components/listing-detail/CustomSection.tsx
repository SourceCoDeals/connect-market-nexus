interface CustomSectionData {
  title: string;
  description: string;
}

interface CustomSectionProps {
  section: CustomSectionData;
}

export function CustomSection({ section }: CustomSectionProps) {
  return (
    <div className="custom-section">
      <span className="document-label">{section.title}</span>
      <p className="document-subtitle leading-relaxed">{section.description}</p>
    </div>
  );
}