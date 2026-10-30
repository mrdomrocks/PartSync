import { cn } from "cn";

export function PageIntro({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
      <h1 className="font-heading text-4xl tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {lede ? (
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{lede}</p>
      ) : null}
    </header>
  );
}
