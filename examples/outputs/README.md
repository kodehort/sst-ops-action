# SST Operations Action - Output Examples

This directory contains example outputs for the SST Operations Action, organized by operation type. These examples are used for documentation, testing, and validation of the parsers and formatters.

## Directory Structure

```
outputs/
├── diff/                 # Diff operation examples
├── deploy/               # Deploy operation examples (future)
├── remove/               # Remove operation examples (future)
└── README.md             # This file
```

## File Types

For each example, the following files are generated:

- **`*-raw.txt`** - Original SST CLI output
- **`*-comment.md`** - Formatted GitHub PR comment
- **`*-summary.md`** - Formatted GitHub Action summary
- **`*-metadata.json`** - Parsed metadata and file references

## Example Types

### Real Examples
Generated from actual SST CLI output (from `INPUT.md`):
- `real-output-1-*` - Large infrastructure deployment (120 changes)
- `real-output-2-*` - Development environment with updates (268 changes)

### Synthetic Examples  
Hand-crafted examples for specific test cases:
- `synthetic-complex-*` - Complex diff with multiple change types
- `synthetic-no-changes-*` - Diff with no infrastructure changes

## Usage

### Generate Examples

```bash
# Generate all examples
bun run scripts/generate-examples.ts

# Generate only diff examples
bun run scripts/generate-examples.ts --operation diff

# Validate parsing accuracy
bun run scripts/generate-examples.ts --validate
```

### Adding New Examples

1. **For real outputs**: Add new SST CLI output to `INPUT.md` in code blocks
2. **For synthetic examples**: Edit `scripts/generate-examples.ts` and add to the synthetic examples section
3. **For other operations**: Create new subdirectories and extend the script

### Using Examples in Tests

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// Load example metadata
const metadata = JSON.parse(
  readFileSync(join(process.cwd(), 'examples/outputs/diff/real-output-1-metadata.json'), 'utf8')
);

// Load raw output for parsing tests
const rawOutput = readFileSync(
  join(process.cwd(), metadata.files.raw), 'utf8'
);

// Load expected formatted output for comparison
const expectedComment = readFileSync(
  join(process.cwd(), metadata.files.comment), 'utf8'
);
```

## Validation

The validation feature checks that:

- App and stage names are correctly extracted
- Change counts match between summary and detailed changes
- All changes have valid type, name, and action
- Permalink URLs are properly formatted
- Success status is consistent

Run validation after making changes to parsers:

```bash
bun run scripts/generate-examples.ts --validate
```

## Integration with Documentation

Examples are automatically used in:
- README.md (embedded in documentation)
- Test fixtures (for regression testing) 
- GitHub Action outputs (for visual verification)

## Contributing

When adding new SST output examples:

1. Add the raw output to `INPUT.md` in a code block
2. Run the generator to create formatted examples
3. Verify the parsing accuracy with `--validate`
4. Commit both the raw input and generated examples

This ensures we maintain accurate parsing and formatting as SST evolves.