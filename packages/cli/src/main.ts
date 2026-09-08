import { main } from "./index";


main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(e.stack ?? e.message);
    process.exit(70);
  },
);
