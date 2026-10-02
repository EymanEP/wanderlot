// What the site's API says to the friends, in their language: the site sends
// the one it's showing in the x-wanderlot-locale header. Errors meant for
// code ("expected {pin}") stay in English.
import { copy, DEFAULT_LOCALE, isLocale, type Locale } from "@wanderlot/core";

export const LOCALE_HEADER = "x-wanderlot-locale";

export function requestLocale(header: string | undefined): Locale {
  return isLocale(header) ? header : DEFAULT_LOCALE;
}

export const SERVER_COPY = copy({
  es: {
    tooMany: "Demasiados intentos; espera un minuto",
    noInvite: "Esta invitación no existe",
    inviteUsed: "Esta invitación ya se usó",
    flowExpired: "El intento caducó; vuelve a empezar",
    passkeyNotVerified: "No se pudo verificar la passkey",
    passkeyGone: "Esta passkey ya no vale aquí. Pide una invitación nueva.",
    passkeyNotChecked: "No se pudo comprobar la passkey",
    wrongPin: "Nombre o PIN incorrectos",
    locked: (wait: string) => `Demasiados intentos. Prueba otra vez en ${wait} o pide una invitación nueva.`,
    day: "1 día",
    pinLength: (n: number) => `El PIN son ${n} números`,
    pinRepeated: "Ese PIN es demasiado fácil: evita repetir el mismo número",
    pinSequence: "Ese PIN es demasiado fácil: evita 1234 y parecidos",
    pinCommon: "Ese PIN es demasiado fácil: elige otro",
    datesNotDecided: "las fechas del viaje aún no están decididas",
    noDatesVote: "este viaje no tiene votación de fechas",
    datesDecided: "las fechas ya están decididas",
    answerAll: "Responde a todas las fechas",
    voteState: (closed: boolean) => `la votación está ${closed ? "cerrada" : "sin abrir"}`,
    countHidden: "el recuento se ve al cerrar la votación",
    voteClosed: "la votación ya se cerró",
    suggestion: "Escribe el destino (hasta 80 letras) y, si quieres, por qué",
    tooManyIdeas: (n: number) => `Ya tienes ${n} ideas pendientes en este viaje`,
  },
  en: {
    tooMany: "Too many tries; wait a minute",
    noInvite: "This invite doesn't exist",
    inviteUsed: "This invite has already been used",
    flowExpired: "That took too long; start again",
    passkeyNotVerified: "Couldn't verify the passkey",
    passkeyGone: "This passkey doesn't work here any more. Ask for a new invite.",
    passkeyNotChecked: "Couldn't check the passkey",
    wrongPin: "Wrong name or PIN",
    locked: (wait: string) => `Too many tries. Try again in ${wait} or ask for a new invite.`,
    day: "1 day",
    pinLength: (n: number) => `The PIN is ${n} digits`,
    pinRepeated: "That PIN is too easy: don't repeat the same digit",
    pinSequence: "That PIN is too easy: avoid 1234 and the like",
    pinCommon: "That PIN is too easy: pick another",
    datesNotDecided: "the trip's dates aren't decided yet",
    noDatesVote: "this trip has no dates vote",
    datesDecided: "the dates are already decided",
    answerAll: "Answer every date",
    voteState: (closed: boolean) => `voting is ${closed ? "closed" : "not open yet"}`,
    countHidden: "the count shows once voting closes",
    voteClosed: "voting has already closed",
    suggestion: "Write the destination (up to 80 characters) and, if you like, why",
    tooManyIdeas: (n: number) => `You already have ${n} ideas waiting on this trip`,
  },
});

export type ServerCopy = (typeof SERVER_COPY)["es"];
