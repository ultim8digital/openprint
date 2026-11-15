# Geometry compiler provenance

`cad.py` adapts the declarative geometry compiler and precise B-Rep bounding-box
measurement from `ultim8digital/neofab`, commit
`d65ab5d9dd760fc34f3bc43329fb18a11948bab8` (2026, MIT).
The original copyright and license are preserved in [LICENSE](LICENSE).

Only the geometry implementation was adapted. The source repository's history,
credentials, provider clients, worker networking, generated executable source,
strength/motion solvers and drawing pipeline are not included.

This extraction adds a versioned JSON contract, stricter bounded validation,
per-component exports, archive/manifest verification data, CSV formula escaping,
one-shot resource-limited CLI and tests. CadQuery and its dependencies retain their
respective upstream licenses; this notice does not relicense them.
