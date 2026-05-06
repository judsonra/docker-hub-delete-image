const readline = require('node:readline/promises');
const path = require('node:path');
const { stdin: input, stdout: output } = require('node:process');
const { chromium, expect } = require('@playwright/test');

const TARGET_DELETE_COUNT = 15;
const REPOSITORY_NAME = 'minha-org/meu-repositorio';
const REPOSITORY_URL =
  'https://hub.docker.com/repository/docker/minha-org/meu-repositorio/image-management?filters=manifest&sortField=last_pulled&sortOrder=asc';
const USER_DATA_DIR = path.resolve(__dirname, '..', '.playwright', 'dockerhub-profile');

const NAVIGATION_TIMEOUT_MS = 60_000;
const ACTION_TIMEOUT_MS = 30_000;
const DELETE_COMPLETION_TIMEOUT_MS = 120_000;
const BETWEEN_BATCHES_DELAY_MS = 5_000;

function parseRepeatCount(value) {
  if (value === undefined || value === '') {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`REPEAT_COUNT invalido: "${value}". Use um inteiro positivo.`);
  }

  const repeatCount = Number(value);
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1) {
    throw new Error(`REPEAT_COUNT invalido: "${value}". Use um inteiro positivo.`);
  }

  return repeatCount;
}

async function waitForManualLogin(page) {
  const rl = readline.createInterface({ input, output });

  console.log(`Abrindo Docker Hub com perfil persistente: ${USER_DATA_DIR}`);
  console.log('Faca login manualmente se necessario. Cookies e preferencias serao reaproveitados nas proximas execucoes.');
  await page.goto('https://hub.docker.com/', {
    waitUntil: 'domcontentloaded',
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  await rl.question('Depois de concluir o login ou confirmar que a sessao ja esta ativa, pressione Enter para continuar...');
  rl.close();
}

async function openRepositoryPage(page) {
  console.log(`Acessando ${REPOSITORY_URL}`);
  await page.goto(REPOSITORY_URL, {
    waitUntil: 'domcontentloaded',
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  await expect(page).toHaveURL(/hub\.docker\.com\/repository\/docker\/grupoitss\/portalpm-backend\/image-management/, {
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  await page.getByText(REPOSITORY_NAME, { exact: false }).first().waitFor({
    state: 'visible',
    timeout: NAVIGATION_TIMEOUT_MS,
  });
}

async function selectCurrentPage(page) {
  const checkbox = page.getByRole('checkbox', { name: /select all rows|unselect all rows/i }).first();
  await checkbox.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });

  const checked = await checkbox.isChecked();
  if (!checked) {
    await checkbox.click({ timeout: ACTION_TIMEOUT_MS });
  }
}

async function getPreviewDeleteButton(page) {
  const previewButton = page.getByTestId('preview-delete-button');
  await previewButton.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });

  const label = (await previewButton.innerText()).replace(/\s+/g, ' ').trim();
  const expectedLabel = `Preview and delete (${TARGET_DELETE_COUNT})`;

  if (label !== expectedLabel) {
    throw new Error(`Contador inesperado no botao de preview: "${label}". Esperado: "${expectedLabel}". Abortando antes do delete.`);
  }

  return previewButton;
}

async function confirmDeleteForever(page) {
  const deleteInput = page.getByPlaceholder('Type delete');
  await deleteInput.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
  await deleteInput.fill('delete');

  const deleteForeverButton = page.getByRole('button', { name: /^Delete forever$/ });
  await deleteForeverButton.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
  await deleteForeverButton.click({ timeout: ACTION_TIMEOUT_MS });
}

async function closeDeleteResult(page) {
  const closeButton = page.getByRole('button', { name: /^Close$/ });
  await closeButton.waitFor({ state: 'visible', timeout: DELETE_COMPLETION_TIMEOUT_MS });
  await closeButton.click({ timeout: ACTION_TIMEOUT_MS });
}

async function runDeleteBatch(page, batchNumber, repeatCount) {
  console.log(`Iniciando lote ${batchNumber}/${repeatCount}.`);

  await openRepositoryPage(page);
  await selectCurrentPage(page);

  const previewButton = await getPreviewDeleteButton(page);
  await previewButton.click({ timeout: ACTION_TIMEOUT_MS });

  await confirmDeleteForever(page);
  console.log('Delete confirmado. Aguardando conclusao...');

  await closeDeleteResult(page);
  console.log(`Lote ${batchNumber}/${repeatCount} finalizado.`);

  if (batchNumber < repeatCount) {
    await page.waitForTimeout(BETWEEN_BATCHES_DELAY_MS);
  }
}

async function main() {
  const repeatCount = parseRepeatCount(process.env.REPEAT_COUNT);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 100,
  });

  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);

  try {
    await waitForManualLogin(page);

    for (let batchNumber = 1; batchNumber <= repeatCount; batchNumber += 1) {
      await runDeleteBatch(page, batchNumber, repeatCount);
    }

    console.log(`Execucao concluida. Total de lotes executados: ${repeatCount}.`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
