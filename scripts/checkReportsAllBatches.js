const {
    execFileSync
} = require("child_process");

const path = require("path");

for (const script of [
    "checkReportsBatchA.js",
    "checkReportsBatchB.js",
    "checkReportsBatchC.js",
    "checkReportsBatchD.js",
    "checkReportsBatchE.js",
    "checkReportsBatchF.js"
]) {
    execFileSync(
        process.execPath,
        [
            path.join(
                __dirname,
                script
            )
        ],
        {
            stdio: "inherit"
        }
    );
}

console.log(
    "Reports Batches A-F checks passed."
);
