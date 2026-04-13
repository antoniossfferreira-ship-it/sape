#!/bin/bash
set -e

echo "== Procurando definições de useFirestore/useUser e imports de @/firebase =="
grep -RIn "useFirestore\|useUser\|from \"@/firebase\"\|from '@/firebase'" src || true

echo
echo "== Procurando arquivos/pastas firebase em src =="
find src -maxdepth 4 \( -iname "*firebase*" -o -path "*/firebase/*" \) | sort
