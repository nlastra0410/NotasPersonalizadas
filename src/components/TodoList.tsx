import React, { useState } from 'react';
import { TaskItem, Priority, Notebook } from '../types';
import { calculateTaskStats, sortTasks } from '../utils/taskManager';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Sparkles,
  Filter,
  Check,
  Download,
} from 'lucide-react';

interface TodoListProps {
  tasks: TaskItem[];
  notebooks: Notebook[];
  onTasksChange: (tasks: TaskItem[]) => void;
  onOpenVoiceForTask?: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({
  tasks,
  notebooks,
  onTasksChange,
  onOpenVoiceForTask,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed' | 'high'>('all');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('all');
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [newTaskNotebookId, setNewTaskNotebookId] = useState<string>('');

  const stats = calculateTaskStats(tasks);
  const sortedTasks = sortTasks(tasks);

  // Filter tasks based on current criteria
  const filteredTasks = sortedTasks.filter((t) => {
    if (filterMode === 'pending' && t.completed) return false;
    if (filterMode === 'completed' && !t.completed) return false;
    if (filterMode === 'high' && t.priority !== 'high') return false;
    if (selectedNotebookId !== 'all' && t.notebookId !== selectedNotebookId) return false;
    return true;
  });

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : undefined,
        };
      }
      return t;
    });
    onTasksChange(updated);
  };

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      completed: false,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || undefined,
      notebookId: newTaskNotebookId || undefined,
      createdAt: Date.now(),
    };

    onTasksChange([newTask, ...tasks]);
    setNewTaskText('');
    setNewTaskDueDate('');
  };

  const handleDeleteTask = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
  };

  const handleClearCompleted = () => {
    onTasksChange(tasks.filter((t) => !t.completed));
  };

  const priorityStyles: Record<Priority, { label: string; bg: string; text: string; dot: string }> = {
    high: {
      label: 'Alta',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
      text: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
    },
    medium: {
      label: 'Media',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    low: {
      label: 'Baja',
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
      text: 'text-blue-700 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
  };

  return (
    <div className="flex-1 h-full bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Header & Stats Banner */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              Lista de Tareas
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Organiza pendientes, fecha límite y transfiere tareas reconocidas por stylus o voz.
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{stats.completed} de {stats.total} completadas</span>
              <span>{stats.percent}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Quick Add Bar */}
          <form
            onSubmit={handleAddTask}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 md:p-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Escribe una nueva tarea o pulsa dictado por voz..."
                className="flex-1 text-sm bg-transparent px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                aria-label="Nueva tarea"
              />

              <div className="flex items-center gap-2 flex-wrap">
                {/* Priority Selector */}
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  aria-label="Prioridad"
                >
                  <option value="high">Prioridad Alta</option>
                  <option value="medium">Prioridad Media</option>
                  <option value="low">Prioridad Baja</option>
                </select>

                {/* Due Date */}
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  aria-label="Fecha de vencimiento"
                />

                <button
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                  aria-label="Añadir tarea"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir</span>
                </button>
              </div>
            </div>
          </form>

          {/* Filter Tabs & Notebook Select */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Todas ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterMode === 'pending'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Pendientes ({stats.pending})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterMode === 'completed'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Completadas ({stats.completed})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('high')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterMode === 'high'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Alta Prioridad
              </button>
            </div>

            {stats.completed > 0 && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                Limpiar completadas
              </button>
            )}
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No hay tareas en esta vista
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Agrega nuevas tareas arriba o escribe en tu cuaderno con el lápiz y pulsa &quot;A Tareas&quot;.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const priority = priorityStyles[task.priority];
                const notebook = notebooks.find((n) => n.id === task.notebookId);

                return (
                  <div
                    key={task.id}
                    className={`group bg-white dark:bg-slate-900 rounded-2xl p-3.5 border transition-all flex items-center justify-between gap-3 shadow-xs ${
                      task.completed
                        ? 'opacity-65 border-slate-200 dark:border-slate-800/60 bg-slate-50/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    {/* Checkbox & Text */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          task.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500'
                        }`}
                        aria-label={task.completed ? 'Marcar incompleta' : 'Marcar completada'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm block break-words ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200 font-medium'
                          }`}
                        >
                          {task.text}
                        </span>

                        {/* Metadata badges */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Priority badge */}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${priority.bg} ${priority.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                            {priority.label}
                          </span>

                          {/* Due Date */}
                          {task.dueDate && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {task.dueDate}
                            </span>
                          )}

                          {/* Notebook association */}
                          {notebook && (
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                              style={{ borderLeft: `3px solid ${notebook.color}` }}
                            >
                              {notebook.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-40 group-hover:opacity-100 p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                      title="Eliminar tarea"
                      aria-label="Eliminar tarea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
