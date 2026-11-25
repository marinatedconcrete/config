# Format a justfile.
[no-cd]
format file="justfile":
    just --unstable --fmt --justfile {{ quote(file) }}

# Check the format of a justfile.
[no-cd]
check file="justfile":
    just --unstable --fmt --check --justfile {{ quote(file) }}
