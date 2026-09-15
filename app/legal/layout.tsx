import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <article
            className="
              text-[15px] leading-[1.9] text-text-secondary
              [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-text-primary
              [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary
              [&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-text-primary
              [&_p]:mb-4
              [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
              [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5
              [&_a]:text-accent-ai [&_a]:underline [&_a]:underline-offset-2
              [&_strong]:font-semibold [&_strong]:text-text-primary
            "
          >
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
