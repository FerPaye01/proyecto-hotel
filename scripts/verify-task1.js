/**
 * Verificación completa de la Tarea 1
 * Verifica todos los cambios de la migración 005
 */

require('dotenv').config();
const pool = require('../src/config/database');

async function runVerification() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICACIÓN TAREA 1: Sistema de Usuario Automatizado    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const tests = [];
  
  try {
    // TEST 1: Verificar que existe el usuario del sistema
    console.log('📋 TEST 1: Verificando usuario del sistema...');
    const systemUserQuery = `
      SELECT id, email, role, full_name, password_hash, 
             created_at, updated_at 
      FROM users 
      WHERE role = 'system'
    `;
    const systemUserResult = await pool.query(systemUserQuery);
    
    if (systemUserResult.rows.length > 0) {
      const user = systemUserResult.rows[0];
      console.log('   ✅ Usuario del sistema encontrado:');
      console.log('      • Email:', user.email);
      console.log('      • Role:', user.role);
      console.log('      • Nombre:', user.full_name);
      console.log('      • Password:', user.password_hash);
      console.log('      • ID:', user.id);
      console.log('      • Creado:', user.created_at);
      console.log('      • Actualizado:', user.updated_at || 'N/A');
      tests.push({ name: 'Usuario del sistema existe', passed: true });
    } else {
      console.log('   ❌ Usuario del sistema NO encontrado');
      tests.push({ name: 'Usuario del sistema existe', passed: false });
    }

    // TEST 2: Verificar columna updated_at
    console.log('\n📋 TEST 2: Verificando columna updated_at...');
    const columnQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `;
    const columnResult = await pool.query(columnQuery);
    
    if (columnResult.rows.length > 0) {
      const col = columnResult.rows[0];
      console.log('   ✅ Columna updated_at existe:');
      console.log('      • Tipo:', col.data_type);
      console.log('      • Nullable:', col.is_nullable);
      tests.push({ name: 'Columna updated_at existe', passed: true });
    } else {
      console.log('   ❌ Columna updated_at NO existe');
      tests.push({ name: 'Columna updated_at existe', passed: false });
    }

    // TEST 3: Verificar constraint de roles
    console.log('\n📋 TEST 3: Verificando constraint de roles...');
    const constraintQuery = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'users_role_check'
    `;
    const constraintResult = await pool.query(constraintQuery);
    
    if (constraintResult.rows.length > 0) {
      const constraint = constraintResult.rows[0];
      const hasSystem = constraint.definition.includes('system');
      
      if (hasSystem) {
        console.log('   ✅ Constraint incluye rol "system":');
        console.log('      •', constraint.definition);
        tests.push({ name: 'Constraint incluye system', passed: true });
      } else {
        console.log('   ❌ Constraint NO incluye rol "system":');
        console.log('      •', constraint.definition);
        tests.push({ name: 'Constraint incluye system', passed: false });
      }
    } else {
      console.log('   ❌ Constraint users_role_check NO encontrado');
      tests.push({ name: 'Constraint incluye system', passed: false });
    }

    // TEST 4: Verificar reglas de inmutabilidad en audit_logs
    console.log('\n📋 TEST 4: Verificando reglas de inmutabilidad...');
    const rulesQuery = `
      SELECT rulename, tablename
      FROM pg_rules
      WHERE tablename = 'audit_logs'
      ORDER BY rulename
    `;
    const rulesResult = await pool.query(rulesQuery);
    
    if (rulesResult.rows.length >= 2) {
      console.log('   ✅ Reglas de inmutabilidad encontradas:');
      rulesResult.rows.forEach(rule => {
        console.log(`      • ${rule.rulename}`);
      });
      
      const hasNoUpdate = rulesResult.rows.some(r => r.rulename === 'audit_logs_no_update');
      const hasNoDelete = rulesResult.rows.some(r => r.rulename === 'audit_logs_no_delete');
      
      if (hasNoUpdate && hasNoDelete) {
        tests.push({ name: 'Reglas de inmutabilidad existen', passed: true });
      } else {
        console.log('   ⚠️  Faltan algunas reglas esperadas');
        tests.push({ name: 'Reglas de inmutabilidad existen', passed: false });
      }
    } else {
      console.log('   ❌ Reglas de inmutabilidad NO encontradas');
      tests.push({ name: 'Reglas de inmutabilidad existen', passed: false });
    }

    // TEST 5: Verificar que el trigger de updated_at existe
    console.log('\n📋 TEST 5: Verificando trigger de updated_at...');
    const triggerQuery = `
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'users' 
      AND trigger_name = 'update_users_updated_at'
    `;
    const triggerResult = await pool.query(triggerQuery);
    
    if (triggerResult.rows.length > 0) {
      console.log('   ✅ Trigger de updated_at existe:');
      console.log('      • Nombre:', triggerResult.rows[0].trigger_name);
      console.log('      • Evento:', triggerResult.rows[0].event_manipulation);
      tests.push({ name: 'Trigger de updated_at existe', passed: true });
    } else {
      console.log('   ❌ Trigger de updated_at NO existe');
      tests.push({ name: 'Trigger de updated_at existe', passed: false });
    }

    // TEST 6: Contar todos los usuarios por rol
    console.log('\n📋 TEST 6: Conteo de usuarios por rol...');
    const countQuery = `
      SELECT role, COUNT(*) as total
      FROM users
      GROUP BY role
      ORDER BY role
    `;
    const countResult = await pool.query(countQuery);
    
    console.log('   ℹ️  Distribución de usuarios:');
    countResult.rows.forEach(row => {
      console.log(`      • ${row.role}: ${row.total} usuario(s)`);
    });
    tests.push({ name: 'Conteo de usuarios', passed: true });

    // RESUMEN FINAL
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMEN DE TESTS                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;
    
    tests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`   ${icon} ${test.name}`);
    });
    
    console.log(`\n   Total: ${passed}/${total} tests pasados`);
    
    if (passed === total) {
      console.log('\n   🎉 ¡TODOS LOS TESTS PASARON! La migración fue exitosa.\n');
    } else {
      console.log('\n   ⚠️  Algunos tests fallaron. Revisa los detalles arriba.\n');
    }
    
    process.exit(passed === total ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error durante la verificación:');
    console.error('   Mensaje:', error.message);
    if (error.stack) console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

runVerification();
