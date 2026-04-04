#!/usr/bin/env python3
"""Contract test for canonical scaffold traceability ownership."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRACEABILITY_DOC = ROOT / "docs" / "scaffold_traceability.md"


CANONICAL_ROW = re.compile(r"^\|\s*(\d{2})\s*\|")
DRIFT_ROW = re.compile(r"^\|\s*`((?:2[2-9]|3[0-6])_[^`]+\.gs)`\s*\|")


def _lines() -> list[str]:
    return TRACEABILITY_DOC.read_text(encoding="utf-8").splitlines()


def main() -> None:
    if not TRACEABILITY_DOC.exists():
        raise SystemExit(f"Missing traceability document: {TRACEABILITY_DOC}")

    lines = _lines()

    canonical_ids: list[str] = []
    drift_files: list[str] = []
    drift_targets: dict[str, str] = {}

    for line in lines:
        c_match = CANONICAL_ROW.match(line)
        if c_match:
            canonical_ids.append(c_match.group(1))
            continue

        d_match = DRIFT_ROW.match(line)
        if d_match:
            drift_file = d_match.group(1)
            parts = [p.strip() for p in line.split("|")]
            # Markdown row shape: | file | status | canonical | responsibility |
            if len(parts) < 5 or not re.fullmatch(r"\d{2}", parts[3]):
                raise AssertionError(f"Missing canonical target module in drift row: {line}")
            drift_files.append(drift_file)
            drift_targets[drift_file] = parts[3]

    expected_canonical = [f"{i:02d}" for i in range(22)]
    if sorted(canonical_ids) != expected_canonical:
        raise AssertionError(
            "Canonical modules must include each ID 00-21 exactly once. "
            f"Found: {canonical_ids}"
        )

    expected_drift = sorted(
        p.name
        for p in ROOT.glob("[23][0-9]_*.gs")
        if 22 <= int(p.name.split("_", 1)[0]) <= 36
    )

    if sorted(drift_files) != expected_drift:
        raise AssertionError(
            "Drift mapping must include every 22_*.gs-36_*.gs file exactly once. "
            f"Expected: {expected_drift}; Found: {sorted(drift_files)}"
        )

    if len(set(drift_files)) != len(drift_files):
        raise AssertionError("Duplicate drift file entries detected in traceability mapping.")

    for drift_file, canonical_target in drift_targets.items():
        if canonical_target not in expected_canonical:
            raise AssertionError(
                f"Drift file {drift_file} maps to invalid canonical module {canonical_target}."
            )

    print("Traceability contract OK")


if __name__ == "__main__":
    main()
