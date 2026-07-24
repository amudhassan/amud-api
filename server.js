const dotenv = require("dotenv");
const app = require("./app");

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT,"0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});