interface Props {
  title: string;
  description?: string;
}

export function SettingsContentHead({ title, description }: Props) {
  return (
    <div className="mb-6 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
