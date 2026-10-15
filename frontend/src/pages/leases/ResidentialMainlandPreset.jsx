import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

export default function ResidentialMainlandPreset({ ownerPublicId, busy, onInstalling, onInstalled, onError }) {
    const [preset, setPreset] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(false);

    const load = async signal => {
        setLoading(true);
        setLoadError("");
        try {
            const response = await apiClient.get("/lease-clause-templates/defaults/residential-mainland", { signal });
            if (!signal?.aborted) setPreset(response.data.data);
        } catch (error) {
            if (!signal?.aborted) setLoadError(error?.response?.data?.message || "Unable to load the default template.");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    };
    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, []);

    const install = async () => {
        if (!ownerPublicId || busy || installing) return;
        setInstalling(true);
        onInstalling(true);
        try {
            const response = await apiClient.post("/lease-clause-templates/defaults/residential-mainland", {
                owner_public_id: ownerPublicId
            });
            await onInstalled(response.data.data.template.public_id, response.data.message);
        } catch (error) {
            onError(error?.response?.data?.message || "Unable to add the default template.");
        } finally {
            setInstalling(false);
            onInstalling(false);
        }
    };

    return (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5" aria-labelledby="residential-preset-title">
            <h3 id="residential-preset-title" className="font-bold text-slate-950">Default template: Makazi — Tanzania Bara</h3>
            {loading && <p className="mt-2 text-sm text-slate-600">Loading default clauses...</p>}
            {loadError && <div role="alert" className="mt-2 text-sm text-rose-700">
                {loadError} <button type="button" className="underline" onClick={() => load()} disabled={loading}>Retry</button>
            </div>}
            {preset && <>
                <p lang="sw" className="mt-2 text-sm text-slate-700">{preset.applicability}</p>
                <p lang="sw" className="mt-2 text-sm text-slate-700">{preset.description}</p>
                <details className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
                    <summary className="cursor-pointer font-semibold text-blue-800">Preview {preset.items.length} clauses and review checklist</summary>
                    <div lang="sw" className="mt-4 space-y-4 text-sm text-slate-700">
                        <h4 className="font-bold">Kabla ya kusaini</h4>
                        <ul className="list-disc space-y-2 pl-5">{preset.review_checklist.map(text => <li key={text}>{text}</li>)}</ul>
                        <p>Alama ya “Mandatory” inaonyesha kifungu kimejumuishwa kwenye template; haimaanishi kila kifungu ni amri ya sheria.</p>
                        <ol className="list-decimal space-y-4 pl-5">{preset.items.map(item => <li key={item.display_order}>
                            <h4 className="font-semibold">{item.title}</h4><p className="mt-1 whitespace-pre-wrap">{item.clause_text}</p>
                        </li>)}</ol>
                        <h4 className="font-bold">Vyanzo vya sheria</h4>
                        <ul className="space-y-2">{preset.sources.map(source => <li key={source.url}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-blue-700 underline">{source.title}</a>
                        </li>)}</ul>
                    </div>
                </details>
                <div className="mt-4">
                    <Button type="button" onClick={install} disabled={!ownerPublicId || busy || installing}>
                        {installing ? "Adding default template..." : "Add / open mainland residential template"}
                    </Button>
                    <p className="mt-2 text-xs text-slate-600">{!ownerPublicId ? "Select an owner first. " : ""}An existing copy opens without overwriting your edits. Review the owner copy, then apply it to a Draft lease.</p>
                </div>
            </>}
        </section>
    );
}
