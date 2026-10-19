'use client';

import { useEffect, useMemo, useState } from 'react';
import { createNeighborhoodDefinition, resolveNeighborhood } from '@/lib/neighborhoods';
import reviewDefinitions from '@/data/neighborhood-review-candidates.json';
import type { NeighborhoodPreset, NeighborhoodReviewCandidate, ParcelFeature } from '@/types/budget';

const reviewCandidates: NeighborhoodReviewCandidate[] = reviewDefinitions;

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  features: ParcelFeature[];
  parcels: ParcelFeature[];
  generated: string;
  selectedPreset: NeighborhoodPreset | null;
  onSelect: (preset: NeighborhoodPreset, features: ParcelFeature[]) => void;
  onStartNew: () => void;
  onShowMap: () => void;
  onRemove: (id: string) => void;
  onExit: () => void;
}

export default function NeighborhoodSetupPanel({
  name, onNameChange, features, parcels, generated, selectedPreset, onSelect,
  onStartNew, onShowMap, onRemove, onExit,
}: Props) {
  const [message, setMessage] = useState('');
  const [copyError, setCopyError] = useState('');
  const definition = useMemo(
    () => createNeighborhoodDefinition(name, features, generated),
    [name, features, generated],
  );
  const { issues } = useMemo(
    () => resolveNeighborhood(definition, parcels),
    [definition, parcels],
  );
  const json = JSON.stringify(definition, null, 2);
  const candidates = useMemo(
    () => reviewCandidates.map((preset) => ({ preset, ...resolveNeighborhood(preset, parcels) })),
    [parcels],
  );

  useEffect(() => {
    setMessage('');
    setCopyError('');
  }, [json]);

  const copy = async () => {
    setCopyError('');
    setMessage('');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable.');
      await navigator.clipboard.writeText(json);
      setMessage('Neighborhood definition copied. Paste it into the repository or this chat for review.');
    } catch {
      setCopyError('Could not copy to the clipboard. Select the JSON below and copy it manually.');
    }
  };

  return (
    <section aria-labelledby="neighborhood-setup-heading" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="neighborhood-setup-heading" className="font-semibold text-gray-900">Local neighborhood setup</h2>
        <button type="button" onClick={onExit} className="rounded border bg-white px-3 py-1 text-sm">
          Exit setup
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-700">
        Development only. Start with a neighborhood button or draw an analysis area, then click
        individual parcels to add or remove them. All map parcels are shown while setting up,
        regardless of the value filters. Nothing is saved in the browser or on a server.
      </p>
      {candidates.length > 0 && <>
      <h3 className="mt-3 text-sm font-semibold">Preview unapproved area starters</h3>
      <p className="mt-1 text-sm text-amber-900">
        These local-only selections are starting points, not confirmed boundaries. Selecting one
        replaces the current draft.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map(({ preset, features: candidateFeatures, issues: candidateIssues }) => (
          <button
            key={preset.id}
            type="button"
            disabled={candidateIssues.length > 0}
            aria-pressed={selectedPreset?.id === preset.id}
            onClick={() => onSelect(preset, candidateFeatures)}
            className="rounded border border-amber-400 bg-white px-3 py-2 text-sm font-medium aria-pressed:bg-amber-200 disabled:opacity-40"
          >
            Preview {preset.name} ({preset.parcelIds.length.toLocaleString()})
          </button>
        ))}
      </div>
      {reviewCandidates.some((candidate) => candidate.unmappedParcelIds.length > 0) && <p className="mt-2 text-xs text-amber-900">
        Known source parcels absent from the map and excluded from these totals:{' '}
        {reviewCandidates.filter((candidate) => candidate.unmappedParcelIds.length > 0)
          .map((candidate) => `${candidate.name}: ${candidate.unmappedParcelIds.join(', ')}`).join('; ')}.
        Manual editing cannot add parcels missing from the map dataset.
      </p>}
      {candidates.filter((candidate) => candidate.issues.length > 0).map(({ preset, issues: candidateIssues }) => (
        <div key={preset.id} role="alert" className="mt-2 text-sm text-red-700">
          <p>{preset.name} preview is unavailable:</p>
          <ul className="list-disc pl-5">{candidateIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      ))}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer">Review candidate sources and coverage</summary>
        {reviewCandidates.map((candidate) => (
          <div key={candidate.id} className="mt-2">
            <p className="font-medium">{candidate.name}</p>
            <p>{candidate.description}</p>
            <p className="break-words text-xs text-gray-600">{candidate.source}</p>
          </div>
        ))}
      </details>
      </>}
      <label htmlFor="neighborhood-name" className="mt-3 block text-sm font-medium">Neighborhood or district name</label>
      <input
        id="neighborhood-name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="e.g. Powell Place"
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onShowMap} className="rounded border bg-white px-3 py-2 text-sm">
          View highlighted parcels on map
        </button>
        <button type="button" onClick={onStartNew} className="rounded border bg-white px-3 py-2 text-sm">
          Start empty selection (keep name)
        </button>
      </div>
      <p className="mt-2 text-sm font-medium">{features.length.toLocaleString()} parcels selected</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer">Review selected parcels</summary>
        <ul className="mt-2 max-h-48 overflow-y-auto divide-y rounded border bg-white">
          {features.map((feature, index) => (
            <li key={`${feature.properties.parcel_id}-${index}`} className="flex items-center justify-between gap-2 p-2">
              <span>{feature.properties.parcel_id} - {feature.properties.address || 'No address'}</span>
              <button
                type="button"
                onClick={() => onRemove(feature.properties.parcel_id)}
                aria-label={`Remove parcel ${feature.properties.parcel_id}`}
                className="rounded border px-2 py-1 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </details>
      {issues.length > 0 && (
        <div role="alert" className="mt-3 text-sm text-amber-900">
          <p className="font-medium">Before exporting:</p>
          <ul className="list-disc pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      )}
      <button
        type="button"
        disabled={issues.length > 0}
        onClick={copy}
        className="mt-3 rounded bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Copy neighborhood definition
      </button>
      {message && <p role="status" className="mt-2 text-sm text-green-800">{message}</p>}
      {copyError && <p role="alert" className="mt-2 text-sm text-red-700">{copyError}</p>}
      <label htmlFor="neighborhood-json" className="mt-3 block text-sm font-medium">
        Neighborhood definition JSON (copy manually if needed)
      </label>
      <textarea
        id="neighborhood-json"
        readOnly
        value={json}
        rows={8}
        className="mt-1 w-full rounded border bg-white p-2 font-mono text-xs"
      />
      <p className="mt-2 text-xs text-gray-600">
        Paste the reviewed definition into the array in public/data/neighborhoods.json, then
        run npm test and npm run build before committing. Use a unique neighborhood ID, or
        replace the existing entry when updating a neighborhood.
      </p>
    </section>
  );
}
