-- =============================================================================
-- Conteúdo inicial oficial: categorias e as 30 questões do treinamento
-- Magazord Envios. Incluído como migração para que seja aplicado também em
-- produção (`supabase db push`). É idempotente (código único por questão).
--
-- "topic" preserva a categoria original informada em cada questão; o
-- "category_id" agrupa as questões nas 9 categorias de desempenho exibidas
-- nos painéis. "study_tip" é a recomendação de reforço exibida quando a
-- questão é respondida incorretamente (derivada da explicação oficial).
-- =============================================================================

insert into public.categories (slug, name, description, sort_order) values
  ('atendimento-organizacao', 'Atendimento e organização', 'Canais de atendimento, organização de tickets e acompanhamento das demandas.', 1),
  ('rastreamento', 'Rastreamento', 'Leitura e interpretação do rastreio e dos status de movimentação.', 2),
  ('ocorrencias', 'Ocorrências', 'Atraso, acareação, extravio, avaria e troca de etiqueta.', 3),
  ('entrega-interceptacao', 'Entrega e interceptação', 'Endereço, tentativas de entrega e interceptação.', 4),
  ('prazos', 'Prazos', 'Prazos de solicitação e de retorno da transportadora.', 5),
  ('ressarcimento', 'Ressarcimento', 'Regras, valores e forma de pagamento de ressarcimentos.', 6),
  ('faturamento', 'Faturamento', 'Modelo pós-pago, documentos fiscais e consultas no sistema.', 7),
  ('comunicacao', 'Comunicação', 'Responsabilidades e comunicação correta com o lojista.', 8),
  ('tomada-decisao', 'Tomada de decisão', 'Análise de cenários completos e escolha do procedimento adequado.', 9)
on conflict (slug) do nothing;

create or replace function private.seed_question(
  p_code text, p_category_slug text, p_topic text, p_difficulty public.question_difficulty,
  p_statement text, p_a text, p_b text, p_c text, p_d text, p_correct char(1),
  p_explanation text, p_tip text
) returns void language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if exists (select 1 from public.questions where code = p_code) then return; end if;
  insert into public.questions (code, category_id, topic, statement, difficulty, explanation, study_tip, in_standard_set)
  values (p_code, (select id from public.categories where slug = p_category_slug), p_topic, p_statement,
          p_difficulty, p_explanation, p_tip, true)
  returning id into v_id;
  insert into public.question_options (question_id, option_label, option_text, is_correct) values
    (v_id, 'A', p_a, p_correct = 'A'),
    (v_id, 'B', p_b, p_correct = 'B'),
    (v_id, 'C', p_c, p_correct = 'C'),
    (v_id, 'D', p_d, p_correct = 'D');
end $$;

select private.seed_question('Q01', 'atendimento-organizacao', 'Atendimento e organização', 'facil',
$$Um lojista entra em contato pelo chat solicitando informações sobre uma ocorrência de atraso que já está sendo acompanhada por outro analista através de um ticket. Qual é a conduta correta?$$,
$$Informar pelo chat todas as atualizações disponíveis no ticket.$$,
$$Abrir uma nova solicitação à J&T para acelerar o processo.$$,
$$Orientar o lojista a acompanhar a demanda pelo ticket correspondente.$$,
$$Encerrar o ticket atual e continuar o atendimento pelo chat.$$,
'C',
$$A equipe de chat é responsável por orientar e direcionar demandas. Informações sobre tickets em andamento devem ser acompanhadas pelo canal correto, ou seja, pelo próprio ticket.$$,
$$Revisar o papel do chat (orientar e direcionar) e o acompanhamento de demandas pelo próprio ticket.$$);

select private.seed_question('Q02', 'atendimento-organizacao', 'Atendimento e organização', 'facil',
$$Um lojista possui três pedidos com problemas de entrega e deseja abrir uma única solicitação para resolver todos eles. Qual procedimento deve ser adotado?$$,
$$Abrir um único ticket, informando os três códigos de rastreio.$$,
$$Abrir um ticket para cada pedido.$$,
$$Abrir um ticket e solicitar que a J&T analise todos os pedidos juntos.$$,
$$Realizar o atendimento pelo chat, sem necessidade de tickets.$$,
'B',
$$A regra da operação é um pedido por ticket ou atendimento. Isso facilita a identificação, investigação e acompanhamento individual de cada ocorrência.$$,
$$Reforçar a regra "um pedido por ticket ou atendimento".$$);

select private.seed_question('Q03', 'atendimento-organizacao', 'Atendimento e organização', 'facil',
$$Um lojista abre um ticket informando que seu pedido está atrasado. Antes de encaminhar qualquer solicitação à J&T, o que o analista deve fazer?$$,
$$Solicitar imediatamente uma agilização.$$,
$$Consultar o histórico do rastreio, identificar a última movimentação, verificar os prazos e conferir se já existe outro atendimento.$$,
$$Informar que a entrega será realizada em até 48 horas.$$,
$$Solicitar o ressarcimento do valor do produto.$$,
'B',
$$Antes de qualquer tratativa, o analista deve conferir o código do pedido, rastreio, nota fiscal quando necessária, histórico, prazo, situação atual e existência de outro atendimento.$$,
$$Revisar o checklist de conferência antes de qualquer tratativa: pedido, rastreio, nota fiscal, histórico, prazo e atendimentos existentes.$$);

select private.seed_question('Q04', 'comunicacao', 'Responsabilidades', 'media',
$$Um lojista solicita que a Magazord entre em contato diretamente com o motorista para pedir que ele entregue o pedido em um horário específico. Qual deve ser a orientação?$$,
$$Informar que a Magazord pode determinar o horário de entrega.$$,
$$Garantir que o motorista receberá a solicitação.$$,
$$Explicar que a Magazord não possui autonomia para solicitar diretamente aos motoristas alterações na entrega.$$,
$$Solicitar que o lojista abra outro ticket com o mesmo pedido.$$,
'C',
$$A Magazord é intermediadora logística e não possui autonomia para determinar horários ou solicitar diretamente aos motoristas alterações na entrega.$$,
$$Revisar as responsabilidades da Magazord (intermediadora logística) e da transportadora.$$);

select private.seed_question('Q05', 'atendimento-organizacao', 'Atendimento e organização', 'media',
$$Um lojista entra pelo chat perguntando se a J&T já respondeu uma solicitação de avaria que está em análise por ticket. Qual é o procedimento adequado?$$,
$$Consultar o ticket e informar todo o histórico pelo chat.$$,
$$Informar que a equipe responsável pela tratativa atualiza o lojista diretamente pelo ticket.$$,
$$Abrir uma segunda solicitação de avaria.$$,
$$Informar que a solicitação foi aprovada, pois já está em análise.$$,
'B',
$$A equipe de tickets é responsável pelas tratativas, acompanhamento dos retornos e atualização do lojista dentro do próprio ticket.$$,
$$Praticar situações de atendimento via chat e ticket: quem atualiza o lojista e por qual canal.$$);

select private.seed_question('Q06', 'rastreamento', 'Rastreamento', 'facil',
$$Um lojista informa que seu pedido teve uma movimentação durante a tarde, mas ela ainda não aparece na página de rastreio da Magazord. Qual informação do manual deve ser considerada?$$,
$$O rastreio atualiza automaticamente a cada hora.$$,
$$O rastreio atualiza automaticamente diariamente às 21h.$$,
$$O rastreio atualiza somente quando o pedido é entregue.$$,
$$O rastreio atualiza apenas quando o lojista abre um ticket.$$,
'B',
$$A atualização automática da página de rastreio da Magazord ocorre diariamente às 21h. Entretanto, prazos específicos de primeira bipagem ou movimentação interna informados pela J&T também devem ser considerados.$$,
$$Revisar o horário de atualização automática do rastreio (diariamente às 21h).$$);

select private.seed_question('Q07', 'rastreamento', 'Rastreamento', 'facil',
$$Ao consultar o rastreio, o analista identifica que o pedido está com o status "Em transferência". O que isso significa?$$,
$$O pedido já está com o entregador.$$,
$$O pedido foi entregue ao destinatário.$$,
$$O pedido está sendo movimentado entre unidades logísticas.$$,
$$O pedido está retornando obrigatoriamente ao remetente.$$,
'C',
$$O status "Em transferência" indica que o pedido está sendo movimentado entre unidades logísticas da transportadora.$$,
$$Revisar o significado dos status de rastreio, como "Em transferência".$$);

select private.seed_question('Q08', 'rastreamento', 'Rastreamento', 'facil',
$$Um lojista consulta o rastreio e identifica o status "Erro na assinatura". Qual é a interpretação correta desse status segundo o manual?$$,
$$A entrega foi concluída com sucesso.$$,
$$Houve uma tentativa de entrega sem conclusão.$$,
$$O pedido foi extraviado.$$,
$$O pedido está em transferência entre unidades.$$,
'B',
$$O status indica uma tentativa de entrega que não foi concluída. O analista deve consultar o rastreio e verificar a ocorrência para identificar a necessidade de uma análise.$$,
$$Revisar a interpretação do status "Erro na assinatura" (tentativa de entrega sem conclusão).$$);

select private.seed_question('Q09', 'ocorrencias', 'Atraso na entrega', 'media',
$$Um lojista abre um ticket informando que seu pedido não apresenta movimentações recentes e que o prazo de entrega está atrasado. Qual procedimento deve ser adotado?$$,
$$Confirmar o extravio imediatamente.$$,
$$Consultar o rastreio, identificar a última movimentação, verificar o tempo sem atualização e solicitar análise à J&T quando necessário.$$,
$$Solicitar uma acareação.$$,
$$Informar que o pedido será entregue em até 48 horas úteis.$$,
'B',
$$Para ocorrências de atraso, o analista deve investigar o histórico, verificar o tempo sem movimentação e, quando necessário, encaminhar uma solicitação à J&T. O prazo de retorno é de até 48 horas úteis, mas não representa uma previsão de entrega.$$,
$$Revisar o procedimento de atraso: investigar o histórico antes de solicitar análise à J&T.$$);

select private.seed_question('Q10', 'ocorrencias', 'Acareação', 'media',
$$Um cliente entra em contato afirmando que não recebeu sua encomenda, mas no sistema a entrega consta como "Concluída". Qual é o processo correto a ser aberto e seu prazo de retorno?$$,
$$Avaria, com prazo de retorno de até 8 dias úteis.$$,
$$Atraso na entrega, com prazo de retorno de até 48 horas úteis.$$,
$$Interceptação, com prazo de retorno de até 72 horas úteis.$$,
$$Acareação, com prazo de retorno de até 8 dias úteis.$$,
'D',
$$A acareação é a solicitação de investigação de uma entrega que consta como realizada, mas que é contestada pelo destinatário. A J&T verifica informações como quem recebeu, onde ocorreu a entrega e as comprovações disponíveis. O prazo de retorno é de até 8 dias úteis.$$,
$$Reforçar quando abrir uma acareação (entrega contestada) e o prazo de retorno de até 8 dias úteis.$$);

select private.seed_question('Q11', 'prazos', 'Acareação e prazos', 'media',
$$Um lojista informa que seu cliente não recebeu o pedido, que consta como entregue há 5 dias corridos. Ainda é possível solicitar uma acareação?$$,
$$Não, pois o prazo é de apenas 3 dias corridos.$$,
$$Sim, pois o prazo para solicitação é de até 6 dias corridos após a entrega.$$,
$$Não, pois o prazo é de 5 dias úteis.$$,
$$Sim, pois a solicitação pode ser feita a qualquer momento.$$,
'B',
$$O prazo para solicitar uma acareação é de até 6 dias corridos após a entrega. É fundamental observar esse limite para não perder a possibilidade de abertura da investigação.$$,
$$Memorizar o prazo de solicitação de acareação: até 6 dias corridos após a entrega.$$);

select private.seed_question('Q12', 'ocorrencias', 'Acareação', 'dificil',
$$A J&T finalizou uma acareação, mas não conseguiu apresentar informações que comprovem que o pedido foi entregue ao destinatário. Qual é a interpretação correta?$$,
$$A entrega foi confirmada automaticamente.$$,
$$O pedido deve ser considerado extraviado sem necessidade de análise.$$,
$$A entrega não foi confirmada e a ocorrência segue para avaliação.$$,
$$O lojista deve solicitar uma interceptação.$$,
'C',
$$Quando a transportadora não consegue comprovar a entrega, o resultado é classificado como entrega não confirmada e a ocorrência segue para avaliação. Isso não significa aprovação automática de ressarcimento.$$,
$$Revisar a interpretação do resultado da acareação ("entrega não confirmada" segue para avaliação).$$);

select private.seed_question('Q13', 'ocorrencias', 'Extravio', 'dificil',
$$Um pedido está há 22 dias sem apresentar movimentação no rastreio. O lojista entra em contato exigindo que a Magazord confirme o extravio. Qual deve ser a postura do analista?$$,
$$Confirmar o extravio, pois ultrapassou 20 dias.$$,
$$Informar que, após 20 dias sem atualização, o pedido pode seguir para bloqueio, devolução ou confirmação de extravio, conforme análise da J&T.$$,
$$Solicitar uma acareação obrigatoriamente.$$,
$$Informar que o pedido será ressarcido em até 60 dias.$$,
'B',
$$Após 20 dias sem atualização, o pedido pode seguir para diferentes encaminhamentos, dependendo da análise da transportadora. A Magazord não pode confirmar o extravio antes do posicionamento oficial da J&T.$$,
$$Reforçar que o extravio só é confirmado pela J&T e os encaminhamentos possíveis após 20 dias sem atualização.$$);

select private.seed_question('Q14', 'ocorrencias', 'Extravio e atraso', 'media',
$$Um lojista possui um pedido sem movimentação há vários dias. O analista observa que ainda não existe confirmação oficial de extravio pela J&T. Qual informação pode ser transmitida?$$,
$$O pedido está definitivamente extraviado.$$,
$$O ressarcimento já está garantido.$$,
$$O pedido está sem atualização e será necessário acompanhar ou solicitar uma análise à transportadora.$$,
$$A Magazord não pode mais realizar nenhuma tratativa.$$,
'C',
$$A ausência de movimentação não confirma, por si só, um extravio. O analista precisa verificar o histórico, consultar o prazo de busca e acompanhar o posicionamento da J&T.$$,
$$Reforçar a diferença entre pedido sem atualização e extravio confirmado.$$);

select private.seed_question('Q15', 'ocorrencias', 'Avaria', 'media',
$$Um lojista abre um ticket informando que recebeu um produto danificado. Quais evidências devem ser solicitadas para encaminhar a ocorrência à J&T?$$,
$$Apenas um relato escrito do cliente.$$,
$$Somente uma foto do produto danificado.$$,
$$Foto da etiqueta, da embalagem danificada, da embalagem violada quando aplicável, dos produtos danificados e descrição dos produtos e valores na nota fiscal.$$,
$$Apenas o vídeo do cliente abrindo a embalagem.$$,
'C',
$$O manual exige um conjunto de evidências fotográficas para análise da avaria. As imagens precisam estar nítidas e permitir a identificação da etiqueta e dos danos, além da descrição dos produtos e valores correspondentes na nota fiscal.$$,
$$Revisar a lista de evidências obrigatórias para avaria (etiqueta, embalagens, produtos e nota fiscal).$$);

select private.seed_question('Q16', 'ocorrencias', 'Avaria', 'media',
$$Um lojista envia um vídeo mostrando que a embalagem chegou danificada, mas não envia nenhuma fotografia. O que o analista deve fazer?$$,
$$Encaminhar somente o vídeo, pois ele substitui as fotos.$$,
$$Solicitar as fotografias exigidas pela J&T, pois vídeos não são aceitos como substitutos das evidências fotográficas.$$,
$$Encerrar o ticket por falta de evidências.$$,
$$Solicitar diretamente o ressarcimento.$$,
'B',
$$Vídeos não são aceitos como substitutos das evidências fotográficas exigidas pela J&T. O analista deve solicitar as fotos necessárias antes de encaminhar a ocorrência.$$,
$$Reforçar que vídeos não substituem as fotografias exigidas pela J&T em casos de avaria.$$);

select private.seed_question('Q17', 'ocorrencias', 'Troca de etiqueta', 'media',
$$Um lojista informa que recebeu um pedido que aparentemente pertence a outra pessoa e suspeita de uma troca de etiquetas durante o transporte. Qual procedimento deve ser adotado?$$,
$$Abrir uma solicitação de extravio, com prazo de 8 dias úteis.$$,
$$Solicitar análise de troca de etiqueta à J&T, com prazo de retorno de até 72 horas úteis.$$,
$$Solicitar acareação, com prazo de 6 dias corridos.$$,
$$Solicitar interceptação, com prazo de 48 horas úteis.$$,
'B',
$$A troca de etiqueta é uma ocorrência específica e possui tratativa própria. O analista deve solicitar análise à J&T, considerando o prazo de retorno de até 72 horas úteis. Não deve confundir a ocorrência com extravio.$$,
$$Revisar a tratativa de troca de etiqueta e o prazo de retorno de até 72 horas úteis.$$);

select private.seed_question('Q18', 'entrega-interceptacao', 'Entrega e endereço', 'media',
$$Um lojista percebe que cadastrou o endereço incorretamente e solicita a alteração depois que o pedido já foi enviado. O que o analista deve informar?$$,
$$A Magazord consegue alterar o endereço diretamente.$$,
$$A J&T sempre permite alterações de endereço após o envio.$$,
$$Pelo procedimento padrão da J&T, não é possível solicitar a alteração de endereço após o envio, pois a transportadora segue as informações da nota fiscal.$$,
$$O motorista pode alterar o endereço mediante autorização do lojista.$$,
'C',
$$Após o envio, não é possível solicitar alterações de endereço diretamente pelo procedimento padrão da J&T. Também não se pode garantir entrega em endereço diferente ou alteração diretamente com o motorista.$$,
$$Revisar a regra de alteração de endereço após o envio (a J&T segue a nota fiscal).$$);

select private.seed_question('Q19', 'entrega-interceptacao', 'Interceptação', 'media',
$$Um lojista solicita que um pedido seja impedido de seguir para entrega, pois seu cliente desistiu da compra. Qual procedimento pode ser solicitado?$$,
$$Acareação, com prazo de até 8 dias úteis.$$,
$$Interceptação, com prazo de análise de até 72 horas úteis.$$,
$$Avaria, com prazo de até 8 dias úteis.$$,
$$Agilização, com prazo de até 60 dias corridos.$$,
'B',
$$A interceptação é a solicitação para tentar impedir que o pedido siga para entrega ao destinatário. Seu prazo de análise é de até 72 horas úteis, mas a solicitação não garante que a interceptação será realizada.$$,
$$Revisar a interceptação: finalidade, prazo de análise de até 72 horas úteis e ausência de garantia.$$);

select private.seed_question('Q20', 'entrega-interceptacao', 'Tentativas de entrega', 'facil',
$$Um cliente informa que não estava em casa quando o entregador passou. Segundo o manual, quantas tentativas de entrega a J&T realiza em situações de ausência do destinatário?$$,
$$Uma tentativa.$$,
$$Duas tentativas.$$,
$$Até três tentativas.$$,
$$Cinco tentativas obrigatórias.$$,
'C',
$$A J&T realiza até três tentativas de entrega em situações de ausência do destinatário. O analista deve consultar o rastreio e solicitar análise quando necessário.$$,
$$Memorizar a quantidade de tentativas de entrega da J&T (até três).$$);

select private.seed_question('Q21', 'prazos', 'Prazos', 'facil',
$$Um analista precisa solicitar uma agilização à J&T para um pedido que apresenta atraso. Qual é o prazo de retorno informado no manual?$$,
$$Até 24 horas úteis.$$,
$$Até 48 horas úteis.$$,
$$Até 72 horas úteis.$$,
$$Até 8 dias úteis.$$,
'B',
$$O prazo de retorno para uma solicitação de agilização é de até 48 horas úteis. Esse prazo representa o retorno da transportadora, não uma garantia de que a entrega será realizada nesse período.$$,
$$Revisar os prazos de retorno da J&T, como o de agilização (até 48 horas úteis).$$);

select private.seed_question('Q22', 'comunicacao', 'Prazos e comunicação', 'dificil',
$$Um lojista abre uma solicitação de atraso e, após 48 horas úteis, questiona por que o pedido ainda não foi entregue. Qual é a resposta conceitualmente correta?$$,
$$A J&T descumpriu o prazo de entrega, pois tinha 48 horas para entregar.$$,
$$O prazo de 48 horas úteis corresponde ao retorno da J&T, não necessariamente à resolução da ocorrência ou à entrega.$$,
$$O pedido deve ser considerado extraviado automaticamente.$$,
$$O ressarcimento deve ser solicitado imediatamente.$$,
'B',
$$Os prazos do manual correspondem ao retorno da J&T. A conclusão da tratativa depende da análise e do posicionamento da transportadora.$$,
$$Reforçar que os prazos do manual são de retorno da J&T, e não de entrega ou resolução.$$);

select private.seed_question('Q23', 'ressarcimento', 'Ressarcimento', 'media',
$$Um lojista informa que seu pedido foi extraviado e solicita o ressarcimento imediato. Entretanto, a J&T ainda não concluiu a análise. Como o analista deve proceder?$$,
$$Garantir o ressarcimento, pois o pedido está sem atualização.$$,
$$Informar que o ressarcimento depende da análise e aprovação da J&T.$$,
$$Informar que todos os pedidos extraviados são ressarcidos automaticamente.$$,
$$Solicitar o desconto na fatura antes da aprovação.$$,
'B',
$$O ressarcimento depende do reconhecimento da responsabilidade pela transportadora e da aprovação da indenização. Nunca se deve prometer um ressarcimento antes da aprovação.$$,
$$Reforçar que o ressarcimento depende da aprovação da J&T e nunca deve ser prometido antes.$$);

select private.seed_question('Q24', 'ressarcimento', 'Ressarcimento', 'media',
$$A J&T aprova o ressarcimento de um pedido. O produto possui valor de R$ 250,00 na nota fiscal e o frete custou R$ 30,00. Considerando o manual, qual valor corresponde ao ressarcimento?$$,
$$R$ 280,00, somando produto e frete.$$,
$$R$ 30,00, referente somente ao frete.$$,
$$R$ 250,00, referente ao valor do produto.$$,
$$O valor total da compra, incluindo qualquer serviço adicional.$$,
'C',
$$O valor do ressarcimento corresponde ao produto, conforme nota fiscal ou romaneio, e não ao valor do frete.$$,
$$Revisar a composição do valor de ressarcimento (produto conforme nota fiscal ou romaneio, sem frete).$$);

select private.seed_question('Q25', 'ressarcimento', 'Ressarcimento e financeiro', 'media',
$$Após a aprovação do ressarcimento pela J&T, como é realizado o pagamento ao lojista segundo o manual?$$,
$$Diretamente pela J&T, em até 30 dias úteis.$$,
$$Pela Magazord Envios Intermediação Logística Ltda., em até 60 dias corridos, por meio de desconto na fatura.$$,
$$Pela Magazord, imediatamente após a aprovação.$$,
$$Por transferência bancária obrigatória, em até 8 dias úteis.$$,
'B',
$$O ressarcimento aprovado é realizado pela Magazord Envios Intermediação Logística Ltda., em até 60 dias corridos, através de desconto na fatura.$$,
$$Revisar a forma e o prazo de pagamento do ressarcimento (desconto na fatura, em até 60 dias corridos).$$);

select private.seed_question('Q26', 'faturamento', 'Faturamento', 'media',
$$Um lojista questiona por que não recebe uma cobrança diretamente da J&T, mesmo utilizando os serviços de transporte dessa empresa. Qual explicação está correta?$$,
$$Porque a J&T não realiza cobranças de frete.$$,
$$Porque a Magazord trabalha com modelo pós-pago, centraliza a cobrança e realiza o faturamento consolidado ao lojista.$$,
$$Porque os fretes são sempre gratuitos.$$,
$$Porque o lojista paga diretamente ao motorista no momento da entrega.$$,
'B',
$$No modelo pós-pago, a J&T fatura os fretes para a Magazord, que realiza o faturamento consolidado. Assim, o lojista recebe uma única cobrança mensal centralizada pela Magazord.$$,
$$Revisar o modelo pós-pago e o faturamento consolidado pela Magazord.$$);

select private.seed_question('Q27', 'faturamento', 'Faturamento', 'facil',
$$Um analista precisa orientar um lojista que deseja consultar o documento fiscal referente ao transporte, contendo o valor do frete cobrado pela transportadora. Qual documento deve ser consultado?$$,
$$Boleto.$$,
$$Nota Fiscal de intermediação.$$,
$$CT-e.$$,
$$Cotação.$$,
'C',
$$O CT-e é o documento fiscal do transporte e apresenta o valor do frete da transportadora. A Nota Fiscal de intermediação se refere ao serviço de intermediação prestado pela Magazord.$$,
$$Estudar os documentos utilizados no faturamento: CT-e e Nota Fiscal de intermediação.$$);

select private.seed_question('Q28', 'faturamento', 'Faturamento e sistema', 'facil',
$$Um lojista ou outro setor solicita que o analista consulte os CT-es relacionados aos pedidos faturados. Qual caminho deve ser utilizado no sistema?$$,
$$Pedidos → Rastreamento → Histórico.$$,
$$Faturamento → Monitor CTE → Logística → Controle de Fretes.$$,
$$Logística → Transportadoras → J&T.$$,
$$Financeiro → Boletos → Intermediação.$$,
'B',
$$Segundo o manual, o caminho para consultar os CT-es é Faturamento → Monitor CTE → Logística → Controle de Fretes.$$,
$$Praticar o caminho de consulta de CT-es no sistema (Faturamento → Monitor CTE → Logística → Controle de Fretes).$$);

select private.seed_question('Q29', 'atendimento-organizacao', 'Atendimento e acompanhamento', 'dificil',
$$Um analista abriu uma solicitação à J&T, registrou a tratativa e aguardou o prazo informado. Entretanto, o prazo terminou e ainda não houve resposta. Qual deve ser sua próxima atitude?$$,
$$Encerrar o ticket, pois o prazo já terminou.$$,
$$Informar ao lojista que a solicitação foi aprovada.$$,
$$Realizar o acompanhamento da solicitação, verificar se houve retorno e manter o lojista atualizado pelo ticket.$$,
$$Abrir uma nova solicitação sem consultar o histórico anterior.$$,
'C',
$$O trabalho do analista não termina após o envio da solicitação. É necessário acompanhar os prazos, verificar os retornos, realizar o acompanhamento quando necessário e atualizar o lojista pelo ticket.$$,
$$Reforçar o acompanhamento das solicitações após o prazo e a atualização do lojista pelo ticket.$$);

select private.seed_question('Q30', 'tomada-decisao', 'Tomada de decisão', 'dificil',
$$Um lojista abre um ticket informando que seu cliente não recebeu a encomenda. Ao consultar o rastreio, o analista identifica que o pedido consta como entregue há 4 dias. O lojista afirma que já verificou com o destinatário e ninguém recebeu o pacote. Qual seria a sequência mais adequada?$$,
$$Confirmar o extravio, solicitar o ressarcimento e encerrar o ticket.$$,
$$Solicitar uma interceptação, pois o pedido não foi recebido.$$,
$$Identificar a ocorrência como contestação de entrega, verificar os dados do pedido e do rastreio e solicitar uma acareação dentro do prazo de até 6 dias corridos após a entrega, acompanhando o retorno de até 8 dias úteis.$$,
$$Solicitar uma agilização com prazo de 48 horas úteis e garantir uma nova entrega.$$,
'C',
$$O caso caracteriza uma contestação de entrega. Como o pedido consta como entregue, o procedimento adequado é solicitar uma acareação. Como se passaram apenas 4 dias corridos, ainda está dentro do prazo de solicitação de até 6 dias corridos. Após o encaminhamento, o analista deve acompanhar o retorno da J&T, cujo prazo é de até 8 dias úteis, e manter o lojista informado pelo ticket.$$,
$$Reforçar a diferença entre acareação e extravio e a sequência completa de uma contestação de entrega.$$);

drop function private.seed_question(text, text, text, public.question_difficulty, text, text, text, text, text, char, text, text);
