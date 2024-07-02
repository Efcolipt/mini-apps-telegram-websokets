import { join } from "node:path";
import express from "express";

const app = express();

app.use((req, res, next) => {
	return next();
});

app.use(express.static(join('./', "public")));

const PORT = Number(process.env.PORT || "10000")

app.listen(PORT, () =>
	console.log("Listening", `http://127.0.0.1:${PORT}`),
);