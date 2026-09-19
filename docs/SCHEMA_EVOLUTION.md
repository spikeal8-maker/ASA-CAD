# CadDocument schema evolution

This document defines the persisted-grammar compatibility contract. Machine-readable policy lives in `spec/process/cad-document-schema-policy.v1.json`.

## Schema version

`CadDocument.schemaVersion` identifies an **exact serialized grammar**. It is not a broad generation label. A document carrying a schema version must conform to the persisted grammar declared for that exact version.

`engineVersion` is implementation/build metadata. It does not replace `schemaVersion` and is not a compatibility discriminator.

## When a schema bump is required

A schema bump is required whenever a persisted grammar change can cause an older reader of the same `schemaVersion` to reject or misinterpret a newly written document.

This includes adding a new member to any persisted discriminated union, including:
- a new CadDocument kind;
- a new persisted Sketch entity type;
- a new persisted Constraint type;
- a new Dimension type such as Angular or Radius.

The machine schema policy versions all four current persisted union families explicitly: document kinds, Sketch entity kinds, Constraint kinds and Dimension kinds.

Changing only runtime behavior or implementation metadata does not by itself change the persisted grammar.

## Migration contract

Schema migrations are explicit, deterministic and sequential:

`N -> N+1`

Open may migrate an older supported document in memory until it reaches the current schema. Every step must be registered explicitly. A schema bump without the required migration and fixture evidence is invalid.

Loading and migrating a document must not silently rewrite the stored project. The migrated document is persisted only through an ordinary explicit Save.

## Future documents

A document whose `schemaVersion` is newer than the current reader is rejected explicitly. ASA-CAD does not attempt best-effort parsing of unknown future grammars.

## Frozen schema-v1 grammar

Schema version 1 permanently defines these persisted union sets:

- document kinds: `part | assembly | drawing | fragment | specification | text`;
- Sketch entities: `line | circle | arc`;
- Constraints: `horizontal | vertical | parallel | perpendicular | tangent | concentric | equal | symmetric | pointOnCurve | fixed | coincident`;
- Dimensions: `linear | horizontal | vertical | diameter`.

## Current schema-v2 grammar

Schema version 2 keeps the document-kind, Sketch-entity and Constraint sets exactly unchanged and extends only the Dimension grammar with `radius`:

`linear | horizontal | vertical | diameter | radius`

Therefore the only persisted-union delta from v1 to v2 is Radius Dimension. The built-in `1 -> 2` migration preserves the complete v1 document and advances only `schemaVersion` from 1 to 2. Existing IDs, geometry, dimensions, metadata and `engineVersion` are unchanged.
