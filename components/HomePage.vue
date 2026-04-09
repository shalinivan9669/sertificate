<script setup>
const { paths, syncCourseId } = useRedesignRoutes();

syncCourseId();

const goToProgramSelection = () => navigateTo(paths.value.programSelection);
const goToContacts = () => navigateTo(paths.value.contacts);
const goToCabinet = () => navigateTo(paths.value.cabinet);
const goToB2b = () => navigateTo(paths.value.b2b);
</script>

<template>
<!-- TopNavBar -->
<header class="bg-[#0A192F] sticky top-0 z-50 shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
<nav class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="flex items-center gap-12">
<NuxtLink class="text-2xl font-extrabold tracking-tighter text-white" :to="paths.home">Sertificat.kz</NuxtLink>
<ul class="hidden md:flex gap-8 items-center">
<li><NuxtLink class="text-white border-b-2 border-[#4A90E2] pb-1 font-medium" :to="paths.courses">Catalog</NuxtLink></li>
<li><NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.categories">Accreditation</NuxtLink></li>
<li><NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.cabinet">Check Certificate</NuxtLink></li>
<li><NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.contacts">About</NuxtLink></li>
</ul>
</div>
<div class="flex items-center gap-6">
<button class="text-white material-symbols-outlined hover:text-[#4A90E2] transition-colors" @click="goToCabinet">account_circle</button>
<button class="bg-[#4A90E2] text-white px-6 py-2 font-bold tracking-tight hover:brightness-110 transition-all rounded-sm" @click="goToCabinet">Login</button>
</div>
</nav>
</header>
<main>
<!-- Hero Section -->
<section class="relative h-[870px] flex items-center overflow-hidden industrial-gradient">
<div class="absolute inset-0 opacity-40">
<img alt="Industrial Facility" class="w-full h-full object-cover grayscale mix-blend-overlay" data-alt="dramatic wide shot of a massive kazakhstan oil refinery and gas processing plant at dusk with industrial lights reflecting off steel surfaces" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZPdCt34fMs_xxcsyH0hiT41x3nczLYywaWmY1e-kPUmQgVGVqpn-BdHXdppMGZdu_ZCSEhFqtTAX7LR4WXFjVBea2mEpLS3ahN67xAzVyeMLhxpmE0Nx583DEGXoZ8St5X05OkmST728dhZuEofMrZeByG44GVZEpgT1J7srziIY-oQwzkzXjUnAbwmWGIkdbbFLTEpRE4bXsvxBX3C_wy2l8fuRrcM7zxhN0ffYRel5aEaxNsJK_LhlPlqkGcDaNwQh0dHBzN8Wy"/>
</div>
<div class="relative z-10 max-w-screen-2xl mx-auto px-8 w-full">
<div class="max-w-4xl">
<h1 class="text-white text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
                        Профессиональное обучение и аттестация в промышленной безопасности РК
                    </h1>
<p class="text-on-primary-container text-xl md:text-2xl mb-10 leading-relaxed max-w-2xl font-medium">
                        Аккредитованный учебный центр для подготовки специалистов в области энергетического, горного и промышленного секторов с внесением в государственный реестр.
                    </p>
<div class="flex flex-col sm:flex-row gap-4">
<button class="bg-[#4A90E2] text-white px-10 py-5 text-lg font-extrabold tracking-tight hover:shadow-2xl hover:scale-105 transition-all cubic-bezier(0.2, 0, 0, 1)" @click="goToProgramSelection">
                            Пройти обучение
                        </button>
<button class="bg-transparent border border-white/20 text-white px-10 py-5 text-lg font-extrabold tracking-tight hover:bg-white/10 transition-all" @click="goToContacts">
                            Написать нам
                        </button>
</div>
</div>
</div>
</section>
<!-- Training Directions: Bento Grid Style -->
<section class="py-24 px-8 max-w-screen-2xl mx-auto">
<div class="mb-16">
<span class="text-[#4A90E2] font-bold tracking-widest uppercase text-sm mb-4 block">Направления обучения</span>
<h2 class="text-4xl md:text-5xl font-extrabold text-primary-container">Специализированные программы</h2>
</div>
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
<div class="group p-8 bg-surface-container-low transition-all hover:bg-[#0A192F] hover:text-white relative overflow-hidden">
<span class="material-symbols-outlined text-4xl mb-6 text-[#4A90E2]" data-icon="engineering">engineering</span>
<h3 class="text-2xl font-bold mb-4">Промбез</h3>
<p class="text-sm opacity-80 leading-relaxed">Промышленная безопасность на опасных производственных объектах.</p>
<div class="mt-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-xs font-bold uppercase tracking-widest">Подробнее</span>
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</div>
</div>
<div class="group p-8 bg-surface-container-low transition-all hover:bg-[#0A192F] hover:text-white relative overflow-hidden">
<span class="material-symbols-outlined text-4xl mb-6 text-[#4A90E2]" data-icon="health_and_safety">health_and_safety</span>
<h3 class="text-2xl font-bold mb-4">БиОТ</h3>
<p class="text-sm opacity-80 leading-relaxed">Безопасность и охрана труда. Соответствие государственным стандартам РК.</p>
<div class="mt-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-xs font-bold uppercase tracking-widest">Подробнее</span>
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</div>
</div>
<div class="group p-8 bg-surface-container-low transition-all hover:bg-[#0A192F] hover:text-white relative overflow-hidden">
<span class="material-symbols-outlined text-4xl mb-6 text-[#4A90E2]" data-icon="fire_truck">fire_truck</span>
<h3 class="text-2xl font-bold mb-4">ПТМ</h3>
<p class="text-sm opacity-80 leading-relaxed">Пожарно-технический минимум для руководителей и ответственных лиц.</p>
<div class="mt-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-xs font-bold uppercase tracking-widest">Подробнее</span>
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</div>
</div>
<div class="group p-8 bg-surface-container-low transition-all hover:bg-[#0A192F] hover:text-white relative overflow-hidden">
<span class="material-symbols-outlined text-4xl mb-6 text-[#4A90E2]" data-icon="school">school</span>
<h3 class="text-2xl font-bold mb-4">Квалификация</h3>
<p class="text-sm opacity-80 leading-relaxed">Повышение профессиональной квалификации инженерно-технических работников.</p>
<div class="mt-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-xs font-bold uppercase tracking-widest">Подробнее</span>
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</div>
</div>
</div>
</section>
<!-- How it Works: Industrial Pipeline -->
<section class="bg-surface-container-low py-24 px-8 overflow-hidden">
<div class="max-w-screen-2xl mx-auto">
<div class="text-center mb-20">
<h2 class="text-4xl md:text-5xl font-extrabold text-primary-container mb-4">Процесс сертификации</h2>
<p class="text-on-surface-variant max-w-xl mx-auto">От выбора курса до получения государственного свидетельства в 6 простых шагов.</p>
</div>
<div class="grid grid-cols-1 md:grid-cols-6 gap-0 relative">
<!-- Steps with connecting lines in web view -->
<div class="relative p-6 group">
<div class="w-12 h-12 bg-white text-primary-container font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-sm ring-1 ring-primary/5">01</div>
<h4 class="font-bold text-lg mb-2">Selection</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Выбор программы и подача заявки</p>
</div>
<div class="relative p-6 group border-t md:border-t-0 md:border-l border-primary/10">
<div class="w-12 h-12 bg-white text-primary-container font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-sm ring-1 ring-primary/5">02</div>
<h4 class="font-bold text-lg mb-2">Study</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Доступ к образовательным материалам</p>
</div>
<div class="relative p-6 group border-t md:border-t-0 md:border-l border-primary/10">
<div class="w-12 h-12 bg-white text-primary-container font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-sm ring-1 ring-primary/5">03</div>
<h4 class="font-bold text-lg mb-2">Confirmation</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Подтверждение практических навыков</p>
</div>
<div class="relative p-6 group border-t md:border-t-0 md:border-l border-primary/10">
<div class="w-12 h-12 bg-white text-primary-container font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-sm ring-1 ring-primary/5">04</div>
<h4 class="font-bold text-lg mb-2">Test</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Прохождение итогового тестирования</p>
</div>
<div class="relative p-6 group border-t md:border-t-0 md:border-l border-primary/10">
<div class="w-12 h-12 bg-white text-primary-container font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-sm ring-1 ring-primary/5">05</div>
<h4 class="font-bold text-lg mb-2">Payment</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Финальная оплата услуг сертификации</p>
</div>
<div class="relative p-6 group border-t md:border-t-0 md:border-l border-primary/10">
<div class="w-12 h-12 bg-[#4A90E2] text-white font-black flex items-center justify-center text-xl mb-6 rounded-sm shadow-lg">06</div>
<h4 class="font-bold text-lg mb-2">Cert</h4>
<p class="text-xs text-on-surface-variant leading-relaxed">Выдача сертификата с QR-кодом</p>
</div>
</div>
</div>
</section>
<!-- B2B Block -->
<section class="py-24 px-8 max-w-screen-2xl mx-auto">
<div class="bg-[#0A192F] text-white flex flex-col md:flex-row overflow-hidden rounded-lg">
<div class="md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
<span class="text-[#4A90E2] font-bold uppercase tracking-widest text-sm mb-6">Корпоративный сектор</span>
<h2 class="text-4xl md:text-5xl font-extrabold leading-tight mb-8">Для корпоративных клиентов</h2>
<p class="text-on-primary-container text-lg mb-10 max-w-md">Управляйте сертификацией всего штата сотрудников в одном окне. Контроль сроков, массовое обучение и полная аналитика.</p>
<div>
<button class="bg-[#4A90E2] text-white px-8 py-4 font-bold tracking-tight hover:brightness-110 transition-all flex items-center gap-3" @click="goToB2b">
                            Открыть кабинет
                            <span class="material-symbols-outlined">corporate_fare</span>
</button>
</div>
</div>
<div class="md:w-1/2 relative min-h-[400px]">
<img alt="B2B Management" class="absolute inset-0 w-full h-full object-cover" data-alt="Modern high-tech industrial control room with multiple monitors showing data analytics and worker safety compliance dashboards" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8kdy-UoKGpB5g7ppSTh0XovI0gRidl60XFXmRbxSaXiZKLti1LWzmV7dchuxrQRowWXdoPzPmwIsIGL_QNfvqNC5ExOilY1HFWtQTJGfv2UhjK4Fzk75MdLRUbMwcQqp6FZrvK1k4sPtisUuIXEKS6fRRfMTW-OOBGoObH7Me8hFPKUXe7FpxgUuw0GAybN6yui53SSOY4Wx9bgsDYSBe_PmEwtdEwLO0K_HbpyitmHZPjwX-tM5YPg5NACl0TpXveget6XiZMZr6"/>
<div class="absolute inset-0 bg-gradient-to-r from-[#0A192F] to-transparent"></div>
</div>
</div>
</section>
<!-- Verification Form -->
<section class="py-24 px-8 max-w-screen-2xl mx-auto">
<div class="bg-white p-12 shadow-[0_40px_40px_rgba(10,25,47,0.06)] max-w-4xl mx-auto">
<div class="flex flex-col md:flex-row gap-12 items-center">
<div class="md:w-1/3">
<div class="w-16 h-16 bg-surface-container-high rounded-sm flex items-center justify-center mb-6">
<span class="material-symbols-outlined text-primary-container text-3xl" data-icon="verified">verified</span>
</div>
<h3 class="text-2xl font-extrabold text-primary-container mb-2">Проверка подлинности</h3>
<p class="text-sm text-on-surface-variant">Проверьте статус сертификата в официальном реестре.</p>
</div>
<div class="md:w-2/3 w-full">
<form class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="flex flex-col gap-2">
<label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Номер сертификата</label>
<input class="bg-surface-container-highest border-none p-4 focus:ring-0 focus:border-b-2 focus:border-[#4A90E2] transition-all font-mono" placeholder="SER-2024-XXXX" type="text"/>
</div>
<div class="flex flex-col gap-2">
<label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">ИИН сотрудника</label>
<input class="bg-surface-container-highest border-none p-4 focus:ring-0 focus:border-b-2 focus:border-[#4A90E2] transition-all font-mono" placeholder="12-значный номер" type="text"/>
</div>
<div class="md:col-span-2">
<button class="w-full bg-[#0A192F] text-white font-extrabold py-5 hover:bg-[#162a4a] transition-all flex items-center justify-center gap-2" @click="goToCabinet">
                                    Найти в базе данных
                                    <span class="material-symbols-outlined text-sm">search</span>
</button>
</div>
</form>
</div>
</div>
</div>
</section>
<!-- FAQ Preview -->
<section class="py-24 px-8 max-w-screen-2xl mx-auto">
<div class="mb-12">
<h2 class="text-4xl font-extrabold text-primary-container">Часто задаваемые вопросы</h2>
</div>
<div class="space-y-4 max-w-4xl">
<div class="border-b border-outline-variant/30 py-6 group cursor-pointer">
<div class="flex justify-between items-center">
<h4 class="text-xl font-bold">Как долго длится процесс обучения?</h4>
<span class="material-symbols-outlined group-hover:text-[#4A90E2] transition-colors">expand_more</span>
</div>
</div>
<div class="border-b border-outline-variant/30 py-6 group cursor-pointer">
<div class="flex justify-between items-center">
<h4 class="text-xl font-bold">Вносятся ли данные в государственный реестр?</h4>
<span class="material-symbols-outlined group-hover:text-[#4A90E2] transition-colors">expand_more</span>
</div>
</div>
<div class="border-b border-outline-variant/30 py-6 group cursor-pointer">
<div class="flex justify-between items-center">
<h4 class="text-xl font-bold">Какие документы необходимы для юрлиц?</h4>
<span class="material-symbols-outlined group-hover:text-[#4A90E2] transition-colors">expand_more</span>
</div>
</div>
</div>
</section>
</main>
<!-- Footer -->
<footer class="bg-[#0A192F] text-white">
<div class="w-full py-20 px-8 grid grid-cols-1 md:grid-cols-2 gap-12 max-w-screen-2xl mx-auto border-b border-white/5">
<div class="space-y-8">
<div class="text-3xl font-black">Sertificat.kz</div>
<p class="text-slate-400 max-w-md text-sm leading-relaxed">
                    Ведущий сертификационный центр Казахстана. Мы обеспечиваем соответствие вашего бизнеса самым высоким стандартам промышленной безопасности.
                </p>
<div class="flex gap-4">
<NuxtLink class="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center hover:bg-[#4A90E2] transition-all" :to="paths.contacts">
<span class="material-symbols-outlined text-sm">alternate_email</span>
</NuxtLink>
<NuxtLink class="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center hover:bg-[#4A90E2] transition-all" :to="paths.contacts">
<span class="material-symbols-outlined text-sm">share</span>
</NuxtLink>
<NuxtLink class="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center hover:bg-[#4A90E2] transition-all" :to="paths.contacts">
<span class="material-symbols-outlined text-sm">call</span>
</NuxtLink>
</div>
</div>
<div class="grid grid-cols-2 gap-8">
<div>
<h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">Platform</h5>
<ul class="space-y-4 text-xs text-slate-400">
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.courses">Catalog</NuxtLink></li>
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.cabinet">Verify Certificate</NuxtLink></li>
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.b2b">B2B Portal</NuxtLink></li>
</ul>
</div>
<div>
<h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">Company</h5>
<ul class="space-y-4 text-xs text-slate-400">
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.contacts">About Us</NuxtLink></li>
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.categories">Accreditation</NuxtLink></li>
<li><NuxtLink class="hover:text-white transition-colors" :to="paths.privacy">Privacy Policy</NuxtLink></li>
</ul>
</div>
</div>
</div>
<div class="max-w-screen-2xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 font-medium">
<div>© 2024 Industrial Safety Certification Center Kazakhstan. All rights reserved.</div>
<div class="flex gap-8 mt-4 md:mt-0 uppercase tracking-widest">
<NuxtLink class="hover:underline" :to="paths.privacy">Privacy Policy</NuxtLink>
<NuxtLink class="hover:underline" :to="paths.publicOffer">Terms of Service</NuxtLink>
<NuxtLink class="hover:underline" :to="paths.licenses">Accreditation Details</NuxtLink>
<NuxtLink class="hover:underline" :to="paths.contacts">Contact Support</NuxtLink>
</div>
</div>
</footer>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
}
details summary::-webkit-details-marker {
  display: none;
}
</style>
