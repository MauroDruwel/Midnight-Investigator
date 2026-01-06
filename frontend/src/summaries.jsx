import { useCallback, useEffect, useState } from 'react';
import './components/terminal.css';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const shapeSummary = raw => {
	const base = { suspects: [], summaryText: '' };
	if (!raw) return base;

	const pushSuspect = (item, list) => {
		if (!item || typeof item !== 'object') return;
		const { name, rank, reason } = item;
		const parsedRank = Number.isFinite(Number(rank)) ? Number(rank) : null;
		list.push({
			name: name || 'Unknown suspect',
			rank: parsedRank,
			reason: reason || 'No reason provided.'
		});
	};

	if (Array.isArray(raw)) {
		const suspects = [];
		raw.forEach(entry => {
			if (entry && typeof entry === 'object' && 'summary' in entry) return;
			pushSuspect(entry, suspects);
		});

		const summaryEntry = raw.find(entry => entry && typeof entry === 'object' && 'summary' in entry);
		const summaryText = typeof summaryEntry?.summary === 'string' ? summaryEntry.summary : '';

		return {
			suspects: suspects.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
			summaryText
		};
	}

	if (raw && typeof raw === 'object') {
		const suspects = Array.isArray(raw.ranking) ? raw.ranking : [];
		const summaryText = typeof raw.summary === 'string' ? raw.summary : '';
		if (suspects.length > 0 || summaryText) return {
			suspects: suspects.map(entry => ({
				name: entry.name || 'Unknown suspect',
				rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : null,
				reason: entry.reason || 'No reason provided.'
			})),
			summaryText
		};
	}

	if (typeof raw === 'string') return { ...base, summaryText: raw };
	return base;
};

function SuspectCard({ name, rank, reason }) {
	return (
		<article className="summary-card">
			<div className="summary-rank">{rank ?? '—'}</div>
			<div className="summary-body">
				<p className="summary-name">{name}</p>
				<p className="summary-reason">{reason}</p>
			</div>
		</article>
	);
}

export default function Summaries() {
	const [summary, setSummary] = useState({ suspects: [], summaryText: '' });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const loadSummary = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/summary`);
			if (!res.ok) throw new Error('Failed to load summary');
			const data = await res.json();
			setSummary(shapeSummary(data?.summary));
		} catch (err) {
			setError(err.message || 'Unable to load summary');
			setSummary({ suspects: [], summaryText: '' });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSummary();
	}, [loadSummary]);


	return (
		<div className="terminal-page">
			<div className="noise-layer" aria-hidden="true" />
			<div className="panel summary-panel">
				<header className="summary-head">
					<p className="eyebrow">case summary</p>
					<h1>Suspect rankings</h1>
					<p className="lede">Pulled from cached analysis. It updates automatically when transcripts change.</p>
				</header>

				{loading && <div className="interviews-placeholder">Pulling cached summary…</div>}
				{!loading && error && (
					<div className="interviews-placeholder">
						<p style={{ margin: 0 }}>{error}</p>
					</div>
				)}

				{!loading && !error && (
					<div className="summary-content">
						<div className="summary-grid">
							{summary.suspects.length === 0 && (
								<div className="interviews-placeholder">No rankings available yet.</div>
							)}
							{summary.suspects.map((suspect, idx) => (
								<SuspectCard key={`${suspect.name}-${idx}`} {...suspect} />
							))}
						</div>

						<article className="summary-overview">
							<h2>Overall</h2>
							<p>{summary.summaryText || 'No summary available yet.'}</p>
						</article>
					</div>
				)}
			</div>
		</div>
	);
}
