# CadDocument schema evolution

This document defines the persisted-grammar compatibility contract. Machine-readable policy lives in `spec/process/cad-document-schema-policy.v1.json`.

## Schema version

`CadDocument.schemaVersion` identifies an **exact serialized grammar**. It is not a broad generation label. A document carrying a schema version must conform to the persisted grammar declared for that exact version.

`engineVersion` is implementation/build metadata. It does not replace `schemaVersion` and is not a compatibility discriminator.

## When a schema bump is required

A schema bump is required whenever a persisted grammar change can cause an older reader of the same `schemaVersion` to reject or misinterpret a newly written document.

This includes adding a new member to any persisted discriminated union, for example:
- a new Dimension type such as Angular or Radius;
- a new persisted Sketch entity type;
- a new persisted Constraint type.

Changing only runtime behavior or implementation metadata does not by itself change the persisted grammar.

## Migration contract

Schema migrations are explicit, deterministic and sequential:

`N -> N+1`

Open may migrate an older supported document in memory until it reaches the current schema. Every step must be registered explicitly. A schema bump without the required migration and fixture evidence is invalid.

Loading and migrating a document must not silently rewrite the stored project. The migrated document is persisted only through an ordinary explicit Save.

## Future documents

A document whose `schemaVersion` is newer than the current reader is rejected explicitly. ASA-CAD does not attempt best-effort parsing of unknown future grammars.

## Frozen schema-v1 Dimension grammar

Schema version 1 permanently defines the Dimension discriminants:

`linear | horizontal | vertical | diameter`

Angular and Radius must not be added to schema-v1. Introducing either persisted discriminant requires a new schema version and the corresponding sequential migration evidence.
