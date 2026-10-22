export function RecordNote({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={i}
            className="text-button"
            href={part}
            target="_blank"
            rel="noreferrer"
          >
            Open supporting record ↗
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
