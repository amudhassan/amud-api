const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
        return cb(
            new Error(
                "Only JPG, JPEG, PNG, and WEBP image files are allowed"
            ),
            false
        );
    }

    cb(null, true);
};

const uploadProfileImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});

module.exports = {
    uploadProfileImage
};