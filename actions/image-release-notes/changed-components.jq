.componentVersions
| to_entries
| sort_by(.key)[]
| (.value.removed + .value.unchanged | map(.version) | unique) as $old
| (.value.added + .value.unchanged | map(.version) | unique) as $new
| select(($old | length) > 0 and ($new | length) > 0 and $old != $new)
| "| \(.key) | \($old | join(", ")) | \($new | join(", ")) |"
