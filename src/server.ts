import { app } from "./app.js";
import { env } from "./config/env.js";

const port = env.PORT;

app.listen(port, () => {
  console.info(`Tally API listening on port ${port}`);
});
