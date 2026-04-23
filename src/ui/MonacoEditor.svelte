<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
  import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
  import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
  import { CTX_DTS } from '../sandbox/ctx-types';

  interface Props {
    value: string;
    onChange?: (v: string) => void;
  }
  let { value, onChange }: Props = $props();

  let host: HTMLDivElement | undefined = $state();
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let disposed = false;

  // Configure Monaco workers once
  if (typeof window !== 'undefined' && !(window as any).__autodelver_monaco_init) {
    (window as any).__autodelver_monaco_init = true;
    (self as any).MonacoEnvironment = {
      getWorker(_: string, label: string) {
        if (label === 'typescript' || label === 'javascript') {
          return new tsWorker();
        }
        return new editorWorker();
      },
    };

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      noLib: true,
      lib: [],
    });
    monaco.languages.typescript.javascriptDefaults.addExtraLib(CTX_DTS, 'autodelver/ctx.d.ts');
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.editor.defineTheme('autodelver-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1a1815',
      },
    });
    monaco.editor.defineTheme('autodelver-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1d1c19',
        'editor.foreground': '#eae6dc',
      },
    });
  }

  function currentTheme(): string {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' ? 'autodelver-dark' : 'autodelver-light';
  }

  onMount(() => {
    if (!host) return;
    editor = monaco.editor.create(host, {
      value,
      language: 'javascript',
      theme: currentTheme(),
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      renderLineHighlight: 'line',
    });
    editor.onDidChangeModelContent(() => {
      if (disposed) return;
      onChange?.(editor!.getValue());
    });

    const obs = new MutationObserver(() => {
      if (editor) monaco.editor.setTheme(currentTheme());
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => obs.disconnect();
  });

  // Update value externally (e.g., reset)
  $effect(() => {
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  });

  onDestroy(() => {
    disposed = true;
    editor?.dispose();
  });
</script>

<div class="monaco-host" bind:this={host}></div>

<style>
  .monaco-host {
    width: 100%;
    height: 100%;
    min-height: 260px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }
</style>
