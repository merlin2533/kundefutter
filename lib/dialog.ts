// Ersatz für window.confirm()/alert(): rendert über <DialogHost /> (components/DialogHost.tsx,
// einmal in app/layout.tsx eingebunden) einen eigenen Dialog statt des Browser-Popups — das
// blockiert den Thread nicht, ist auf Mobilgeräten bedienbar und lässt sich stylen.
// Bewusst ohne React-Hook, damit auch Event-Handler und Utility-Funktionen ihn nutzen können.
// Ohne gemounteten Host (SSR/Test) fällt er auf die Browser-Funktionen zurück.

export type DialogAnfrage = {
  art: "confirm" | "alert";
  text: string;
  resolve: (ok: boolean) => void;
};

type Listener = (a: DialogAnfrage) => void;
const listeners = new Set<Listener>();

export function registriereDialogHost(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function zeige(art: DialogAnfrage["art"], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [host] = [...listeners];
    if (!host) {
      if (typeof window === "undefined") return resolve(false);
      if (art === "confirm") return resolve(window.confirm(text));
      window.alert(text);
      return resolve(true);
    }
    host({ art, text, resolve });
  });
}

/** Ja/Nein-Rückfrage. Aufruf: `if (!(await bestaetige("Wirklich löschen?"))) return;` */
export function bestaetige(text: string): Promise<boolean> {
  return zeige("confirm", text);
}

/** Hinweisdialog (OK). Aufruf: `await melde("Passwort mind. 8 Zeichen")` */
export async function melde(text: string): Promise<void> {
  await zeige("alert", text);
}
