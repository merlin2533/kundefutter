// TypeScript 5.5 changed Response.json() from Promise<any> to Promise<unknown>.
// This restores the prior behavior so existing fetch chains don't need individual casts.
interface Body {
  json(): Promise<any>;
}
