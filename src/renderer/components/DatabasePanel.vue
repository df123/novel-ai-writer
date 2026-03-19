<template>
  <div class="database-panel">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 表列表视图 -->
      <el-tab-pane label="表列表" name="tables">
        <div class="panel-header">
          <el-button :icon="Refresh" @click="loadTables">刷新</el-button>
        </div>
        <el-table
          :data="tables"
          v-loading="loading"
          @row-click="handleTableClick"
          style="cursor: pointer"
        >
          <el-table-column prop="name" label="表名" min-width="200" />
          <el-table-column prop="columns" label="列数" width="100">
            <template #default="{ row }">
              {{ row.columns.length }}
            </template>
          </el-table-column>
          <el-table-column prop="rowCount" label="行数" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 数据视图 -->
      <el-tab-pane label="数据视图" name="data" :disabled="!selectedTable">
        <div class="panel-header">
          <div class="header-left">
            <span v-if="selectedTable" class="table-name">{{ selectedTable.name }}</span>
          </div>
          <div class="header-right">
            <el-button :icon="Plus" @click="openCreateDialog">新增</el-button>
            <el-button :icon="Refresh" @click="loadTableData">刷新</el-button>
            <el-button @click="activeTab = 'tables'">返回表列表</el-button>
          </div>
        </div>

        <el-table
          :data="tableData"
          v-loading="loading"
          @sort-change="handleSortChange"
          style="width: 100%"
        >
          <el-table-column
            v-for="column in selectedTable?.columns || []"
            :key="column.name"
            :prop="column.name"
            :label="column.name"
            :sortable="column.primaryKey ? false : 'custom'"
            min-width="120"
          >
            <template #default="{ row }">
              <span>{{ formatCellValue(row[column.name], column.type, column.name) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button :icon="Edit" size="small" text @click="openEditDialog(row)">编辑</el-button>
              <el-popconfirm
                title="确定要删除这条记录吗？"
                @confirm="deleteData(row.id)"
              >
                <template #reference>
                  <el-button :icon="Delete" size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- 自定义查询 -->
      <el-tab-pane label="自定义查询" name="query">
        <div class="query-container">
          <el-input
            v-model="customQuery"
            type="textarea"
            :rows="6"
            placeholder="输入 SQL 查询语句，例如：SELECT * FROM projects WHERE title LIKE '%test%'"
          />
          <div class="query-actions">
            <el-button type="primary" :icon="Search" @click="executeCustomQuery" :loading="loading">
              执行查询
            </el-button>
            <el-button @click="clearQuery">清空</el-button>
          </div>
        </div>

        <div v-if="queryResults.length > 0" class="query-results">
          <el-table :data="queryResults" style="width: 100%">
            <el-table-column
              v-for="(column, index) in queryResultColumns"
              :key="index"
              :prop="column"
              :label="column"
              min-width="120"
            />
          </el-table>
          <div class="result-count">
            共 {{ queryResults.length }} 条结果
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增记录' : '编辑记录'"
      width="600px"
      @close="handleDialogClose"
    >
      <el-form label-width="100px">
        <el-form-item
          v-for="column in editableColumns"
          :key="column.name"
          :label="column.name"
          :required="column.notNull"
        >
          <el-input
            v-if="isTextType(column.type)"
            v-model="formData[column.name]"
            type="textarea"
            :rows="2"
            :placeholder="`请输入${column.name}`"
          />
          <el-input-number
            v-else-if="isNumberType(column.type)"
            v-model="formData[column.name]"
            :placeholder="`请输入${column.name}`"
            style="width: 100%"
          />
          <el-input
            v-else
            v-model="formData[column.name]"
            :placeholder="`请输入${column.name}`"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveData" :loading="loading">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, Refresh, Search } from '@element-plus/icons-vue';
import { dbApi } from '../utils/api';
import type { TableInfo, ColumnInfo } from '@shared/types';

// 表列表
const tables = ref<TableInfo[]>([]);

// 当前选中的表
const selectedTable = ref<TableInfo | null>(null);

// 表数据
const tableData = ref<any[]>([]);

// 分页信息
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
});

// 排序信息
const sortInfo = ref({
  orderBy: '',
  order: 'ASC' as 'ASC' | 'DESC'
});

// 加载状态
const loading = ref(false);

// 当前激活的标签页
const activeTab = ref('tables');

// 对话框状态
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formData = ref<Record<string, any>>({});
const editingId = ref<string | null>(null);

// 自定义查询
const customQuery = ref('');
const queryResults = ref<any[]>([]);
const queryResultColumns = ref<string[]>([]);

// 可编辑的列（排除自动生成的字段）
const editableColumns = computed(() => {
  if (!selectedTable.value) return [];
  const excludedFields = ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'key'];
  return selectedTable.value.columns.filter(col => !excludedFields.includes(col.name));
});

// 判断是否为文本类型
const isTextType = (type: string): boolean => {
  const textTypes = ['TEXT', 'VARCHAR', 'CHAR', 'CLOB'];
  return textTypes.some(t => type.toUpperCase().includes(t));
};

// 判断是否为数字类型
const isNumberType = (type: string): boolean => {
  const numberTypes = ['INTEGER', 'BIGINT', 'SMALLINT', 'REAL', 'FLOAT', 'DOUBLE', 'NUMERIC', 'DECIMAL'];
  return numberTypes.some(t => type.toUpperCase().includes(t));
};

// 已知的时间戳列名
const timestampColumns = ['created_at', 'updated_at', 'timestamp', 'createdAt', 'updatedAt'];

// 格式化单元格值
const formatCellValue = (value: any, type: string, columnName: string): string => {
  if (value === null || value === undefined) return '-';
  
  // 仅对已知的时间戳列进行格式化
  if (timestampColumns.includes(columnName) && type.toUpperCase().includes('INTEGER')) {
    try {
      const date = new Date(value * 1000);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('zh-CN');
      }
    } catch {
      // 忽略格式化错误
    }
  }
  
  return String(value);
};

// 加载所有表
const loadTables = async () => {
  loading.value = true;
  try {
    const response = await dbApi.getTables();
    tables.value = response.data.tables;
    ElMessage.success('表列表加载成功');
  } catch (error) {
    console.error('加载表列表失败:', error);
    ElMessage.error('加载表列表失败');
  } finally {
    loading.value = false;
  }
};

// 加载表数据
const loadTableData = async () => {
  if (!selectedTable.value) return;
  
  loading.value = true;
  try {
    const response = await dbApi.getTableData(selectedTable.value.name, {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      orderBy: sortInfo.value.orderBy || undefined,
      order: sortInfo.value.orderBy ? sortInfo.value.order : undefined
    });
    
    tableData.value = response.data.data;
    pagination.value = response.data.pagination;
  } catch (error) {
    console.error('加载表数据失败:', error);
    ElMessage.error('加载表数据失败');
  } finally {
    loading.value = false;
  }
};

// 处理表点击
const handleTableClick = (row: TableInfo) => {
  selectedTable.value = row;
  pagination.value.page = 1;
  sortInfo.value.orderBy = '';
  sortInfo.value.order = 'ASC';
  activeTab.value = 'data';
  loadTableData();
};

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.page = page;
  loadTableData();
};

// 每页大小变化
const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
  loadTableData();
};

// 排序变化
const handleSortChange = ({ prop, order }: any) => {
  if (!prop) {
    sortInfo.value.orderBy = '';
    sortInfo.value.order = 'ASC';
  } else {
    sortInfo.value.orderBy = prop;
    sortInfo.value.order = order === 'ascending' ? 'ASC' : 'DESC';
  }
  loadTableData();
};

// 打开新增对话框
const openCreateDialog = () => {
  dialogMode.value = 'create';
  formData.value = {};
  editingId.value = null;
  
  // 初始化表单数据
  editableColumns.value.forEach(column => {
    formData.value[column.name] = '';
  });
  
  dialogVisible.value = true;
};

// 打开编辑对话框
const openEditDialog = (row: any) => {
  dialogMode.value = 'edit';
  editingId.value = row.id;
  formData.value = { ...row };
  dialogVisible.value = true;
};

// 保存数据
const saveData = async () => {
  if (!selectedTable.value) return;
  
  loading.value = true;
  try {
    if (dialogMode.value === 'create') {
      await dbApi.insert(selectedTable.value.name, formData.value);
      ElMessage.success('新增成功');
    } else if (dialogMode.value === 'edit' && editingId.value) {
      await dbApi.update(selectedTable.value.name, editingId.value, formData.value);
      ElMessage.success('编辑成功');
    }
    
    dialogVisible.value = false;
    loadTableData();
  } catch (error) {
    console.error('保存数据失败:', error);
    ElMessage.error('保存数据失败');
  } finally {
    loading.value = false;
  }
};

// 删除数据
const deleteData = async (id: string) => {
  if (!selectedTable.value) return;
  
  loading.value = true;
  try {
    await dbApi.delete(selectedTable.value.name, id);
    ElMessage.success('删除成功');
    loadTableData();
  } catch (error) {
    console.error('删除数据失败:', error);
    ElMessage.error('删除数据失败');
  } finally {
    loading.value = false;
  }
};

// 执行自定义查询
const executeCustomQuery = async () => {
  if (!customQuery.value.trim()) {
    ElMessage.warning('请输入 SQL 查询语句');
    return;
  }
  
  loading.value = true;
  try {
    const response = await dbApi.executeQuery(customQuery.value);
    queryResults.value = response.data.results;
    
    // 提取列名
    if (queryResults.value.length > 0) {
      queryResultColumns.value = Object.keys(queryResults.value[0]);
    } else {
      queryResultColumns.value = [];
    }
    
    ElMessage.success('查询执行成功');
  } catch (error) {
    console.error('执行查询失败:', error);
    ElMessage.error('执行查询失败');
  } finally {
    loading.value = false;
  }
};

// 清空查询
const clearQuery = () => {
  customQuery.value = '';
  queryResults.value = [];
  queryResultColumns.value = [];
};

// 对话框关闭时清空表单
const handleDialogClose = () => {
  formData.value = {};
  editingId.value = null;
};

// 组件挂载时加载表列表
onMounted(() => {
  loadTables();
});
</script>

<style scoped>
.database-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.database-panel :deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.database-panel :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.database-panel :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #f5f7fa;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.table-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid #e4e7ed;
  background-color: #f5f7fa;
}

.query-container {
  padding: 16px;
}

.query-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.query-results {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
}

.result-count {
  margin-top: 12px;
  text-align: right;
  font-size: 12px;
  color: #909399;
}

.database-panel :deep(.el-table) {
  flex: 1;
  overflow: auto;
}

.database-panel :deep(.el-scrollbar__wrap) {
  overflow-x: auto;
}
</style>
