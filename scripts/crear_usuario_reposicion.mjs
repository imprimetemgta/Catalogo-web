// Crea o actualiza un usuario de la página de reposición.
// Uso:  node scripts/crear_usuario_reposicion.mjs <usuario>
// La clave se lee por stdin (no como argumento, para que no quede en el
// historial de la terminal): escribirla cuando la pida, o enviarla por pipe
//   echo mi-clave-larga | node scripts/crear_usuario_reposicion.mjs ana
// Solo imprime el SQL; hay que pegarlo en Supabase → SQL Editor.
import { hashClave } from "../lib/reposicion/auth.js";

const MIN_CLAVE = 10;
const MAX_USUARIO = 200;

function salir(msg) {
  console.error(msg);
  process.exit(1);
}

// Lee la clave: por pipe (todo stdin) o escribiéndola sin mostrarla en pantalla.
function leerClave() {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let datos = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (d) => (datos += d));
      stdin.on("end", () => resolve(datos.replace(/\r?\n$/, "")));
      stdin.on("error", reject);
    });
  }
  return new Promise((resolve) => {
    process.stderr.write("Clave (no se muestra): ");
    let clave = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const alRecibir = (tecla) => {
      for (const c of tecla) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", alRecibir);
          process.stderr.write("\n");
          return resolve(clave);
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") clave = clave.slice(0, -1);
        else clave += c;
      }
    };
    stdin.on("data", alRecibir);
  });
}

const usuario = (process.argv[2] ?? "").trim();
if (!usuario) salir("Uso: node scripts/crear_usuario_reposicion.mjs <usuario>");
if (usuario.length > MAX_USUARIO) salir(`El usuario no puede pasar de ${MAX_USUARIO} caracteres.`);

const clave = await leerClave();
if (clave.length < MIN_CLAVE) salir(`La clave debe tener al menos ${MIN_CLAVE} caracteres.`);

const hash = await hashClave(clave);
// Comillas simples duplicadas para que el literal SQL sea válido.
const sql = (s) => `'${s.replaceAll("'", "''")}'`;

console.log(
  `insert into public.usuarios_reposicion (usuario, clave_hash) values (${sql(usuario)}, ${sql(hash)}) ` +
    `on conflict (usuario) do update set clave_hash = excluded.clave_hash, activo = true;`
);
