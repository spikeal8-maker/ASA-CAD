import { LocalCadProjects } from '../../host/LocalCadProjects';
import { downloadLocalCadBackup } from './backup';

const button = document.querySelector<HTMLButtonElement>('#download');
const status = document.querySelector<HTMLElement>('#status');
const origin = document.querySelector<HTMLElement>('#origin');
if (!button || !status || !origin) throw new Error('Не найдены элементы страницы резервной копии');
origin.textContent = window.location.origin;
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Читаем сохранённые документы и записи восстановления…';
  status.dataset.complete = 'pending';
  try {
    const result = await downloadLocalCadBackup(new LocalCadProjects());
    status.dataset.complete = String(result.complete);
    status.textContent = [
      result.complete ? 'Полная копия сохранённых данных сформирована.' : 'Сформирована ЧАСТИЧНАЯ копия. Установка новой версии заблокирована.',
      `Файл: ${result.fileName}`,
      `Записей LocalStorage: ${result.localEntries}; записей восстановления: ${result.recoveryRecords}.`,
      result.sha256 ? `SHA-256: ${result.sha256}` : 'Контрольная сумма не вычислена; требуется отдельная проверка файла.',
      ...result.errors.map(error => `${error.source}${error.key ? ` (${error.key})` : ''}: ${error.message}`),
      'Проверьте наличие файла в загрузках. Эта страница не меняет исходные документы.',
    ].join('\n\n');
  } catch (reason) {
    status.dataset.complete = 'false';
    status.textContent = `Не удалось сформировать копию: ${String(reason)}. Исходные записи не изменены.`;
  } finally { button.disabled = false; }
});
