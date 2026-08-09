import {
    Camera,
    CheckCircle2,
    ImagePlus,
    RefreshCw,
    Save,
    ShieldCheck,
    UserRound
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update your profile.";

const formatRole = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function MyProfilePage() {
    const fileInputRef =
        useRef(null);

    const [profile, setProfile] =
        useState(null);

    const [
        fullName,
        setFullName
    ] = useState("");

    const [
        selectedFile,
        setSelectedFile
    ] = useState(null);

    const [
        previewUrl,
        setPreviewUrl
    ] = useState("");

    const [loading, setLoading] =
        useState(true);

    const [
        savingName,
        setSavingName
    ] = useState(false);

    const [
        uploadingImage,
        setUploadingImage
    ] = useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    const notifyProfileUpdated =
        updatedUser => {
            window.dispatchEvent(
                new CustomEvent(
                    "rental-manager:profile-updated",
                    {
                        detail:
                            updatedUser
                    }
                )
            );
        };

    const loadProfile =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            "/auth/profile"
                        );

                    const loaded =
                        response?.data?.user ||
                        null;

                    setProfile(loaded);

                    setFullName(
                        loaded?.full_name ||
                        ""
                    );

                    if (loaded) {
                        notifyProfileUpdated(
                            loaded
                        );
                    }
                } catch (
                    requestError
                ) {
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl("");
            return undefined;
        }

        const objectUrl =
            URL.createObjectURL(
                selectedFile
            );

        setPreviewUrl(
            objectUrl
        );

        return () => {
            URL.revokeObjectURL(
                objectUrl
            );
        };
    }, [selectedFile]);

    const nameValidation =
        useMemo(() => {
            const value =
                fullName.trim();

            if (
                value.length < 2 ||
                value.length > 150
            ) {
                return "Full name must contain between 2 and 150 characters.";
            }

            return "";
        }, [fullName]);

    const nameChanged =
        Boolean(
            profile &&
            fullName.trim() !==
                String(
                    profile.full_name ||
                    ""
                ).trim()
        );

    const imageToShow =
        previewUrl ||
        profile?.profile_image_url ||
        "";

    const handleFileSelected =
        event => {
            const file =
                event.target.files?.[0] ||
                null;

            setError("");
            setSuccess("");

            if (!file) {
                setSelectedFile(null);
                return;
            }

            if (
                !String(
                    file.type || ""
                ).startsWith(
                    "image/"
                )
            ) {
                setError(
                    "Please select a valid image file."
                );

                event.target.value =
                    "";
                return;
            }

            setSelectedFile(
                file
            );
        };

    const saveName =
        async event => {
            event.preventDefault();

            if (
                nameValidation ||
                !nameChanged ||
                savingName
            ) {
                return;
            }

            try {
                setSavingName(true);
                setError("");
                setSuccess("");

                const response =
                    await apiClient.put(
                        "/auth/profile",
                        {
                            full_name:
                                fullName.trim()
                        }
                    );

                const updated =
                    response?.data?.user;

                if (updated) {
                    setProfile(
                        updated
                    );

                    setFullName(
                        updated.full_name ||
                        ""
                    );

                    notifyProfileUpdated(
                        updated
                    );
                }

                setSuccess(
                    "Profile details updated successfully."
                );
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSavingName(false);
            }
        };

    const uploadImage =
        async () => {
            if (
                !selectedFile ||
                uploadingImage
            ) {
                return;
            }

            try {
                setUploadingImage(true);
                setError("");
                setSuccess("");

                const formData =
                    new FormData();

                formData.append(
                    "profile_image",
                    selectedFile
                );

                const response =
                    await apiClient.put(
                        "/auth/profile-picture",
                        formData
                    );

                const updated =
                    response?.data?.user;

                if (updated) {
                    setProfile(
                        updated
                    );

                    setFullName(
                        updated.full_name ||
                        fullName
                    );

                    notifyProfileUpdated(
                        updated
                    );
                }

                setSelectedFile(
                    null
                );

                if (
                    fileInputRef.current
                ) {
                    fileInputRef.current.value =
                        "";
                }

                setSuccess(
                    "Profile photo updated successfully."
                );
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setUploadingImage(false);
            }
        };

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
                Loading your profile...
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <UserRound className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                                My Profile
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                Manage your personal account details and profile photo.
                            </p>
                        </div>
                    </div>
                </div>

                <IconButton
                    label="Refresh profile"
                    icon={RefreshCw}
                    onClick={
                        loadProfile
                    }
                />
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-semibold text-slate-950">
                        Profile Photo
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        Your profile photo is used across your account and relationship views.
                    </p>

                    <div className="mt-6 flex flex-col items-center">
                        <div className="h-40 w-40 overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200">
                            {imageToShow ? (
                                <img
                                    src={imageToShow}
                                    alt="Profile preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400">
                                    <UserRound className="h-16 w-16" />
                                </div>
                            )}
                        </div>

                        <input
                            ref={
                                fileInputRef
                            }
                            type="file"
                            accept="image/*"
                            onChange={
                                handleFileSelected
                            }
                            className="hidden"
                        />

                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={
                                    ImagePlus
                                }
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                            >
                                Choose Photo
                            </Button>

                            <Button
                                type="button"
                                leftIcon={
                                    Camera
                                }
                                loading={
                                    uploadingImage
                                }
                                disabled={
                                    !selectedFile
                                }
                                onClick={
                                    uploadImage
                                }
                            >
                                Upload Photo
                            </Button>
                        </div>

                        {selectedFile && (
                            <div className="mt-4 w-full rounded-xl border border-blue-100 bg-blue-50 p-3">
                                <p className="text-xs font-semibold text-blue-800">
                                    Ready to upload
                                </p>

                                <p className="mt-1 truncate text-xs text-blue-700">
                                    {
                                        selectedFile.name
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="font-semibold text-slate-950">
                            Account Information
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Your email and system role are shown for reference.
                        </p>
                    </div>

                    <form
                        onSubmit={
                            saveName
                        }
                        className="space-y-5 p-5"
                    >
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                Full Name
                            </label>

                            <input
                                value={
                                    fullName
                                }
                                onChange={
                                    event => {
                                        setFullName(
                                            event.target.value
                                        );
                                        setError("");
                                        setSuccess("");
                                    }
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />

                            {nameValidation && (
                                <p className="mt-1.5 text-xs text-rose-600">
                                    {
                                        nameValidation
                                    }
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                Email Address
                            </label>

                            <input
                                value={
                                    profile?.email ||
                                    ""
                                }
                                readOnly
                                className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
                            />
                        </div>

                        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    System Role
                                </p>

                                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                                    {formatRole(
                                        profile?.role
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Email Verification
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                    {profile?.is_verified
                                        ? "Verified"
                                        : "Unverified"}
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <ActionGroup>
                                <Button
                                    type="submit"
                                    leftIcon={
                                        Save
                                    }
                                    loading={
                                        savingName
                                    }
                                    disabled={
                                        Boolean(
                                            nameValidation
                                        ) ||
                                        !nameChanged
                                    }
                                >
                                    Save Name
                                </Button>
                            </ActionGroup>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}

export default MyProfilePage;
