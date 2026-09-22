import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Shell HTML per il web (PWA): imposta lo sfondo scuro del tema su tutto
 * l'albero (html/body/root) per evitare flash bianchi, overscroll chiari
 * e garantire una prima verniciatura coerente col design system.
 */
const WEB_THEME_CSS = `
  html, body, #root {
    background-color: #0f172a;
  }
  html {
    color-scheme: dark;
  }
  body {
    margin: 0;
  }
  #root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  /* iOS Safari e Android Chrome zoomano automaticamente la pagina quando
     un campo di testo ha font-size < 16px. Su schermi touch alziamo la
     base dei campi a 16px: niente zoom indesiderato, pinch-zoom resta
     disponibile per l'accessibilità. */
  @media (max-width: 768px), (pointer: coarse) {
    input,
    textarea,
    select {
      font-size: 16px !important;
    }
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5"
        />
        <meta name="theme-color" content="#0f172a" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: WEB_THEME_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}